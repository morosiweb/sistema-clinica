import { prisma } from "@/lib/prisma";
import type { EstadoTurno, RolInterno } from "@/app/generated/prisma/client";
import { transaccionAgenda, type Transaccion } from "@/lib/transaccion";
import {
  slotsDetallados,
  minutos,
  horaDesdeMinutos,
} from "@/lib/disponibilidad";
import { fechaDB, fechaClinica, instanteClinica } from "@/lib/fecha";
import { programarAviso } from "@/lib/avisos-turno";
import { ESTADOS_RESERVADOS } from "@/lib/estados-turno";
import { ErrorClinica } from "@/lib/errores";
import { fechaSchema, horaSchema } from "@/lib/validations/comun";

export function sumarMinutos(hora: string, cantidad: number) {
  return horaDesdeMinutos(minutos(hora) + cantidad);
}
export class HorarioOcupadoError extends ErrorClinica {
  constructor() {
    super("Ese horario no está disponible. Elegí otro.", 409);
  }
}
export const VENTANA_MINIMA_HORAS = 4;
export function horasHastaElTurno(fecha: Date, hora: string) {
  return (instanteClinica(fecha, hora).getTime() - Date.now()) / 3600000;
}
export function comprobarVersion(actual: number, recibida: number) {
  if (actual !== recibida)
    throw new ErrorClinica(
      "El registro cambió. Recargá la página antes de guardar.",
      409,
    );
}
export async function validarSlot(
  tx: Transaccion,
  medicoId: string,
  fecha: string,
  hora: string,
  excluir?: string,
) {
  fechaSchema.parse(fecha);
  horaSchema.parse(hora);
  const slot = (await slotsDetallados(medicoId, fecha, tx, excluir)).find(
    (s) => s.horaInicio === hora,
  );
  if (!slot) throw new HorarioOcupadoError();
  return slot;
}

export async function validarPacienteDisponible(
  tx: Transaccion,
  pacienteId: string,
  fecha: string,
  slot: { horaInicio: string; horaFin: string },
  excluir?: string,
) {
  const otro = await tx.turno.findFirst({
    where: {
      pacienteId,
      fecha: fechaDB(fecha),
      estado: { in: [...ESTADOS_RESERVADOS] },
      horaInicio: { lt: slot.horaFin },
      horaFin: { gt: slot.horaInicio },
      ...(excluir ? { id: { not: excluir } } : {}),
    },
    select: { id: true },
  });
  if (otro)
    throw new ErrorClinica(
      "El paciente ya tiene otro turno en ese horario. Elegí un horario que no se superponga.",
      409,
    );
}

type Reserva = {
  pacienteId: string;
  medicoId: string;
  fecha: string;
  horaInicio: string;
  motivoConsulta?: string | null;
  canalReserva: "ONLINE" | "TELEFONO" | "PRESENCIAL";
  realizadoPor: string;
};
export async function crearTurnoEnTx(tx: Transaccion, p: Reserva) {
  const slot = await validarSlot(tx, p.medicoId, p.fecha, p.horaInicio);
  await validarPacienteDisponible(tx, p.pacienteId, p.fecha, slot);
  const turno = await tx.turno.create({
    data: {
      pacienteId: p.pacienteId,
      medicoId: p.medicoId,
      fecha: fechaDB(p.fecha),
      ...slot,
      motivoConsulta: p.motivoConsulta || null,
      canalReserva: p.canalReserva,
      estado: p.canalReserva === "ONLINE" ? "PENDIENTE" : "CONFIRMADO",
      historial: { create: { accion: "CREADO", realizadoPor: p.realizadoPor } },
    },
  });
  await programarAviso(
    tx,
    turno,
    p.canalReserva === "ONLINE" ? "SOLICITUD" : "CONFIRMACION",
  );
  return turno;
}
export function crearTurno(p: Reserva) {
  return transaccionAgenda((tx) => crearTurnoEnTx(tx, p));
}

async function turnoDelPaciente(
  tx: Transaccion,
  turnoId: string,
  pacienteId: string,
  version: number,
) {
  const turno = await tx.turno.findUnique({ where: { id: turnoId } });
  if (!turno || turno.pacienteId !== pacienteId)
    throw new ErrorClinica("Turno no encontrado", 404);
  comprobarVersion(turno.version, version);
  if (
    !["PENDIENTE", "CONFIRMADO"].includes(turno.estado) &&
    !(turno.estado === "CANCELADO" && turno.requiereReprogramacion)
  )
    throw new ErrorClinica("Ese turno ya no se puede modificar online", 409);
  if (
    !turno.requiereReprogramacion &&
    horasHastaElTurno(turno.fecha, turno.horaInicio) < VENTANA_MINIMA_HORAS
  )
    throw new ErrorClinica(
      `Faltan menos de ${VENTANA_MINIMA_HORAS} horas. Comunicate con la clínica.`,
    );
  return turno;
}

export function reprogramarTurno(p: {
  turnoId: string;
  pacienteId: string;
  version: number;
  medicoId: string;
  fecha: string;
  horaInicio: string;
  realizadoPor: string;
  interno?: boolean;
}) {
  return transaccionAgenda(async (tx) => {
    const actual = p.interno
      ? await tx.turno.findUniqueOrThrow({ where: { id: p.turnoId } })
      : await turnoDelPaciente(tx, p.turnoId, p.pacienteId, p.version);
    if (actual.pacienteId !== p.pacienteId)
      throw new ErrorClinica("Turno no encontrado", 404);
    comprobarVersion(actual.version, p.version);
    if (
      p.interno &&
      !["PENDIENTE", "CONFIRMADO", "LLEGO", "EN_ESPERA"].some(
        (e) => e === actual.estado,
      ) &&
      !(actual.estado === "CANCELADO" && actual.requiereReprogramacion)
    )
      throw new ErrorClinica("Este turno ya no puede reprogramarse", 409);
    const tieneRevisiones =
      actual.medicoId !== p.medicoId &&
      (await tx.revisionNota.count({ where: { turnoId: actual.id } }));
    if (
      (actual.notasMedico || tieneRevisiones) &&
      actual.medicoId !== p.medicoId
    )
      throw new ErrorClinica(
        "Para cambiar de médico en este turno, comunicate con la clínica.",
      );
    const slot = await validarSlot(
      tx,
      p.medicoId,
      p.fecha,
      p.horaInicio,
      p.turnoId,
    );
    await validarPacienteDisponible(tx, p.pacienteId, p.fecha, slot, p.turnoId);
    const turno = await tx.turno.update({
      where: { id: p.turnoId, version: p.version },
      data: {
        medicoId: p.medicoId,
        fecha: fechaDB(p.fecha),
        ...slot,
        estado: p.interno ? "CONFIRMADO" : "PENDIENTE",
        requiereReprogramacion: false,
        version: { increment: 1 },
        recordatorioEnviado: false,
        recordatorioError: null,
        recordatorioIntentadoEl: null,
        historial: {
          create: {
            accion: "MODIFICADO",
            realizadoPor: p.realizadoPor,
            detalle: `Reprogramado de ${actual.fecha.toISOString().slice(0, 10)} ${actual.horaInicio} a ${p.fecha} ${p.horaInicio}`,
          },
        },
      },
      include: { medico: { include: { especialidad: true } } },
    });
    await programarAviso(tx, turno, p.interno ? "REPROGRAMACION" : "SOLICITUD");
    return turno;
  });
}

export function cancelarTurnoPaciente(p: {
  turnoId: string;
  pacienteId: string;
  version: number;
  realizadoPor: string;
}) {
  return transaccionAgenda(async (tx) => {
    await turnoDelPaciente(tx, p.turnoId, p.pacienteId, p.version);
    return tx.turno.update({
      where: { id: p.turnoId, version: p.version },
      data: {
        estado: "CANCELADO",
        requiereReprogramacion: false,
        version: { increment: 1 },
        historial: {
          create: {
            accion: "CANCELADO",
            realizadoPor: p.realizadoPor,
            detalle: "Cancelado por el paciente",
          },
        },
      },
    });
  });
}

type Viewer = { rol: RolInterno; medicoId: string | null; id: string };
const TRANSICIONES: Record<EstadoTurno, EstadoTurno[]> = {
  PENDIENTE: ["PENDIENTE", "CONFIRMADO", "CANCELADO", "AUSENTE", "ATENDIDO"],
  CONFIRMADO: [
    "CONFIRMADO",
    "PENDIENTE",
    "LLEGO",
    "EN_ESPERA",
    "EN_CONSULTA",
    "CANCELADO",
    "AUSENTE",
    "ATENDIDO",
  ],
  LLEGO: [
    "LLEGO",
    "CONFIRMADO",
    "EN_ESPERA",
    "EN_CONSULTA",
    "CANCELADO",
    "AUSENTE",
    "ATENDIDO",
  ],
  EN_ESPERA: [
    "EN_ESPERA",
    "LLEGO",
    "EN_CONSULTA",
    "CANCELADO",
    "AUSENTE",
    "ATENDIDO",
  ],
  EN_CONSULTA: ["EN_CONSULTA", "EN_ESPERA", "ATENDIDO", "CANCELADO"],
  CANCELADO: ["CANCELADO", "PENDIENTE", "CONFIRMADO"],
  AUSENTE: ["AUSENTE", "ATENDIDO", "CANCELADO"],
  ATENDIDO: ["ATENDIDO"],
};
export function actualizarTurno(
  id: string,
  data: {
    estado: EstadoTurno;
    notasSecretaria?: string;
    notasMedico?: string;
    version: number;
  },
  viewer: Viewer,
) {
  return transaccionAgenda(async (tx) => {
    const actual = await tx.turno.findUnique({
      where: { id },
      include: {
        paciente: { select: { email: true, telefono: true, nombre: true } },
        medico: { include: { especialidad: true } },
      },
    });
    if (!actual) throw new ErrorClinica("Turno no encontrado", 404);
    if (viewer.rol === "MEDICO" && actual.medicoId !== viewer.medicoId)
      throw new ErrorClinica("Sin acceso", 403);
    comprobarVersion(actual.version, data.version);
    if (!TRANSICIONES[actual.estado].includes(data.estado))
      throw new ErrorClinica("Ese cambio de estado no está permitido", 409);
    if (
      data.estado !== actual.estado &&
      ["LLEGO", "EN_ESPERA", "EN_CONSULTA"].includes(data.estado) &&
      actual.fecha.toISOString().slice(0, 10) !== fechaClinica()
    )
      throw new ErrorClinica(
        "La llegada y la atención se registran el día del turno",
      );
    if (data.estado === "EN_CONSULTA" && viewer.rol === "SECRETARIA")
      throw new ErrorClinica("El médico debe iniciar la consulta", 403);
    if (
      data.estado !== actual.estado &&
      actual.estado !== "EN_CONSULTA" &&
      ["ATENDIDO", "AUSENTE"].includes(data.estado) &&
      horasHastaElTurno(actual.fecha, actual.horaInicio) > 0
    )
      throw new ErrorClinica("El turno todavía no comenzó");
    if (actual.estado === "CANCELADO" && data.estado !== "CANCELADO") {
      const slot = await validarSlot(
        tx,
        actual.medicoId,
        actual.fecha.toISOString().slice(0, 10),
        actual.horaInicio,
        id,
      );
      await validarPacienteDisponible(
        tx,
        actual.pacienteId,
        actual.fecha.toISOString().slice(0, 10),
        slot,
        id,
      );
    }
    const puedeEscribirNotas =
      viewer.rol === "MEDICO" || viewer.rol === "ADMIN";
    const notas =
      puedeEscribirNotas && data.notasMedico !== undefined
        ? data.notasMedico || null
        : actual.notasMedico;
    if (notas !== actual.notasMedico)
      await tx.revisionNota.create({
        data: {
          turnoId: id,
          version: actual.version + 1,
          realizadoPor: viewer.id,
          anterior: actual.notasMedico,
          posterior: notas,
        },
      });
    const turno = await tx.turno.update({
      where: { id, version: data.version },
      data: {
        estado: data.estado,
        requiereReprogramacion:
          actual.estado !== data.estado ? false : actual.requiereReprogramacion,
        notasMedico: notas,
        ...(viewer.rol !== "MEDICO" && data.notasSecretaria !== undefined
          ? { notasSecretaria: data.notasSecretaria || null }
          : {}),
        version: { increment: 1 },
        historial: {
          create: {
            accion: data.estado === "CANCELADO" ? "CANCELADO" : "MODIFICADO",
            realizadoPor: viewer.id,
            detalle: `Estado: ${actual.estado} → ${data.estado}`,
          },
        },
      },
    });
    if (
      actual.estado !== data.estado &&
      (actual.estado === "AUSENTE" || data.estado === "AUSENTE")
    ) {
      const cantidad = await tx.turno.count({
        where: { pacienteId: actual.pacienteId, estado: "AUSENTE" },
      });
      await tx.paciente.update({
        where: { id: actual.pacienteId },
        data: { ausenciasSinAviso: cantidad },
      });
    }
    if (actual.estado !== data.estado && data.estado === "CONFIRMADO")
      await programarAviso(tx, turno, "CONFIRMACION");
    if (actual.estado !== data.estado && data.estado === "CANCELADO")
      await programarAviso(tx, turno, "CANCELACION");
    return { turno, anterior: actual };
  });
}

export async function pacientePorToken(token: string) {
  const { hashToken } = await import("@/lib/token");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ErrorClinica("Link inválido o vencido", 404);
  const paciente = await prisma.paciente.findUnique({
    where: { tokenAccesoHash: hashToken(token) },
  });
  if (!paciente) throw new ErrorClinica("Link inválido o vencido", 404);
  return paciente;
}
