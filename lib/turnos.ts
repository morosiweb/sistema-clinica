import { prisma } from "@/lib/prisma";
import type { EstadoTurno, RolInterno } from "@/app/generated/prisma/client";
import { transaccionAgenda, type Transaccion } from "@/lib/transaccion";
import {
  slotsDetallados,
  minutos,
  horaDesdeMinutos,
} from "@/lib/disponibilidad";
import { fechaDB, instanteClinica } from "@/lib/fecha";
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
}) {
  return transaccionAgenda(async (tx) => {
    const actual = await turnoDelPaciente(
      tx,
      p.turnoId,
      p.pacienteId,
      p.version,
    );
    if (actual.notasMedico && actual.medicoId !== p.medicoId)
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
    return tx.turno.update({
      where: { id: p.turnoId, version: p.version },
      data: {
        medicoId: p.medicoId,
        fecha: fechaDB(p.fecha),
        ...slot,
        estado: "PENDIENTE",
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
  CONFIRMADO: ["CONFIRMADO", "PENDIENTE", "CANCELADO", "AUSENTE", "ATENDIDO"],
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
      ["ATENDIDO", "AUSENTE"].includes(data.estado) &&
      horasHastaElTurno(actual.fecha, actual.horaInicio) > 0
    )
      throw new ErrorClinica("El turno todavía no comenzó");
    if (actual.estado === "CANCELADO" && data.estado !== "CANCELADO")
      await validarSlot(
        tx,
        actual.medicoId,
        actual.fecha.toISOString().slice(0, 10),
        actual.horaInicio,
        id,
      );
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
