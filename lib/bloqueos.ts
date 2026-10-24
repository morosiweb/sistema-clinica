import { ErrorClinica } from "@/lib/errores";
import { fechaDB, fechaClinica } from "@/lib/fecha";
import { sumarDias } from "@/lib/fecha";
import { transaccionAgenda } from "@/lib/transaccion";
import type { BloqueoInput } from "@/lib/validations/bloqueo";
import type { RolInterno } from "@/app/generated/prisma/client";
import { randomUUID } from "node:crypto";

export type ConflictoLicencia = {
  id: string;
  version: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  paciente: { nombre: string; apellido: string; telefono: string | null };
  tieneEmail: boolean;
};

export function registrarLicencia(
  data: BloqueoInput,
  usuario: { id: string; rol: RolInterno; medicoId: string | null },
  pendienteId?: string,
) {
  return transaccionAgenda(async (tx) => {
    if (usuario.rol === "MEDICO" && usuario.medicoId !== data.medicoId)
      throw new ErrorClinica("Sin acceso", 403);
    if (data.fecha < fechaClinica())
      throw new ErrorClinica("La licencia debe ser actual o futura");
    const medico = await tx.medico.findUnique({
      where: { id: data.medicoId },
      select: { activo: true },
    });
    if (!medico?.activo) throw new ErrorClinica("Médico no disponible");
    if (pendienteId) {
      const pendiente = await tx.bloqueoMedico.findUnique({
        where: { id: pendienteId },
      });
      if (
        !pendiente ||
        pendiente.medicoId !== data.medicoId ||
        pendiente.estado !== "PENDIENTE"
      )
        throw new ErrorClinica("La licencia ya fue registrada o resuelta", 409);
    }
    const turnos = await tx.turno.findMany({
      where: {
        medicoId: data.medicoId,
        fecha: {
          gte: fechaDB(data.fecha),
          lte: fechaDB(data.fechaHasta || data.fecha),
        },
        estado: {
          in: ["PENDIENTE", "CONFIRMADO", "LLEGO", "EN_ESPERA", "EN_CONSULTA"],
        },
        horaInicio: { lt: data.horaFin || "24:00" },
        horaFin: { gt: data.horaInicio || "00:00" },
      },
      select: {
        id: true,
        version: true,
        fecha: true,
        horaInicio: true,
        horaFin: true,
        paciente: {
          select: { nombre: true, apellido: true, telefono: true, email: true },
        },
      },
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }, { id: "asc" }],
    });
    const confirmados = data.turnosConfirmados || [];
    const coinciden =
      confirmados.length === turnos.length &&
      new Set(confirmados.map((t) => t.id)).size === confirmados.length &&
      turnos.every((t) =>
        confirmados.some((c) => c.id === t.id && c.version === t.version),
      );
    if (
      (!data.confirmarReprogramacion && turnos.length) ||
      (data.confirmarReprogramacion && !coinciden)
    ) {
      const conflictos: ConflictoLicencia[] = turnos.map((t) => ({
        id: t.id,
        version: t.version,
        fecha: t.fecha.toISOString().slice(0, 10),
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        paciente: {
          nombre: t.paciente.nombre,
          apellido: t.paciente.apellido,
          telefono: t.paciente.telefono,
        },
        tieneEmail: !!t.paciente.email,
      }));
      throw new ErrorClinica(
        "Revisá los turnos que coinciden con esta licencia antes de continuar.",
        409,
        { codigo: "TURNOS_COINCIDENTES", conflictos },
      );
    }
    const ids: string[] = [];
    if (pendienteId) {
      await tx.bloqueoMedico.update({
        where: { id: pendienteId },
        data: { estado: "APROBADO", aprobadoPorId: usuario.id },
      });
      ids.push(pendienteId);
    } else {
      const datos = [];
      for (
        let fecha = data.fecha;
        fecha <= (data.fechaHasta || data.fecha);
        fecha = sumarDias(fecha, 1)
      ) {
        const id = randomUUID();
        ids.push(id);
        datos.push({
          id,
          medicoId: data.medicoId,
          fecha: fechaDB(fecha),
          horaInicio: data.horaInicio || null,
          horaFin: data.horaFin || null,
          motivo: data.motivo,
          estado: "APROBADO" as const,
          aprobadoPorId: usuario.id,
        });
      }
      await tx.bloqueoMedico.createMany({ data: datos });
    }
    const reprogramacionId = turnos.length ? randomUUID() : null;
    if (turnos.length) {
      await tx.turno.updateMany({
        where: { id: { in: turnos.map((t) => t.id) } },
        data: {
          estado: "CANCELADO",
          requiereReprogramacion: true,
          reprogramacionId,
          avisoReprogramacionEnviado: false,
          avisoReprogramacionError: null,
          avisoReprogramacionIntentadoEl: null,
          version: { increment: 1 },
        },
      });
      await tx.historialTurno.createMany({
        data: turnos.map((t) => ({
          id: randomUUID(),
          turnoId: t.id,
          accion: "CANCELADO" as const,
          realizadoPor: usuario.id,
          detalle:
            "Licencia del médico: el turno debe reprogramarse. Se programa un aviso al paciente.",
        })),
      });
    }
    const bloqueos = await tx.bloqueoMedico.findMany({
      where: { id: { in: ids } },
      orderBy: { fecha: "asc" },
    });
    return {
      bloqueos,
      reprogramacionId,
      turnosAfectados: turnos.length,
      notificacionesProgramadas: turnos.filter((t) => t.paciente.email).length,
      sinEmail: turnos.filter((t) => !t.paciente.email).length,
    };
  });
}
