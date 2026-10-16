import { ErrorClinica } from "@/lib/errores";
import { transaccionAgenda } from "@/lib/transaccion";
import { comprobarVersion, sumarMinutos } from "@/lib/turnos";
import { fechaDB, instanteClinica } from "@/lib/fecha";
import {
  fichaMedicaSchema,
  nuevaVisitaSchema,
} from "@/lib/validations/ficha-medica";
import type { z } from "zod";
import type { Transaccion } from "@/lib/transaccion";
import type { RolInterno } from "@/app/generated/prisma/client";

type Viewer = { id: string; rol: RolInterno; medicoId: string | null };
export const fichaSelect = {
  pesoKg: true,
  alturaCm: true,
  grupoSanguineo: true,
  alergias: true,
  antecedentes: true,
  versionFicha: true,
} as const;

async function comprobarTratante(
  tx: Transaccion,
  viewer: Viewer,
  pacienteId: string,
) {
  if (viewer.rol === "ADMIN") return;
  const medico =
    viewer.rol === "MEDICO" && viewer.medicoId
      ? await tx.medico.findUnique({
          where: { id: viewer.medicoId },
          select: { activo: true },
        })
      : null;
  const turno =
    medico?.activo &&
    (await tx.turno.findFirst({
      where: {
        pacienteId,
        medicoId: viewer.medicoId!,
        estado: { not: "CANCELADO" },
      },
      select: { id: true },
    }));
  if (!turno)
    throw new ErrorClinica(
      "Solo el médico tratante puede modificar esta ficha",
      403,
    );
}

export function actualizarFicha(
  pacienteId: string,
  data: z.infer<typeof fichaMedicaSchema>,
  viewer: Viewer,
) {
  return transaccionAgenda(async (tx) => {
    await comprobarTratante(tx, viewer, pacienteId);
    const anterior = await tx.paciente.findUnique({
      where: { id: pacienteId },
      select: fichaSelect,
    });
    if (!anterior) throw new ErrorClinica("Paciente no encontrado", 404);
    comprobarVersion(anterior.versionFicha, data.versionFicha);
    const posterior = await tx.paciente.update({
      where: { id: pacienteId, versionFicha: data.versionFicha },
      select: fichaSelect,
      data: {
        pesoKg: data.pesoKg,
        alturaCm: data.alturaCm,
        grupoSanguineo: data.grupoSanguineo || null,
        alergias: data.alergias || null,
        antecedentes: data.antecedentes || null,
        versionFicha: { increment: 1 },
      },
    });
    await tx.revisionFicha.create({
      data: {
        pacienteId,
        version: posterior.versionFicha,
        realizadoPor: viewer.id,
        anterior,
        posterior,
      },
    });
    return posterior;
  });
}

export function registrarVisita(
  pacienteId: string,
  data: z.infer<typeof nuevaVisitaSchema>,
  viewer: Viewer,
) {
  return transaccionAgenda(async (tx) => {
    if (viewer.rol !== "MEDICO" || !viewer.medicoId)
      throw new ErrorClinica("Sin acceso", 403);
    await comprobarTratante(tx, viewer, pacienteId);
    if (instanteClinica(data.fecha, data.horaInicio).getTime() > Date.now())
      throw new ErrorClinica(
        "No se puede registrar una visita futura como atendida",
      );
    const medico = await tx.medico.findUniqueOrThrow({
      where: { id: viewer.medicoId },
    });
    const horaFin = sumarMinutos(data.horaInicio, medico.duracionTurnoMinutos);
    if (horaFin > "24:00")
      throw new ErrorClinica("La consulta debe terminar en el mismo día");
    const turno = await tx.turno.create({
      data: {
        pacienteId,
        medicoId: viewer.medicoId,
        fecha: fechaDB(data.fecha),
        horaInicio: data.horaInicio,
        horaFin,
        estado: "ATENDIDO",
        canalReserva: "PRESENCIAL",
        motivoConsulta: data.motivoConsulta || null,
        notasMedico: data.notasMedico || null,
        historial: {
          create: {
            accion: "CREADO",
            realizadoPor: viewer.id,
            detalle: "Visita retrospectiva registrada por el médico tratante",
          },
        },
      },
    });
    if (turno.notasMedico)
      await tx.revisionNota.create({
        data: {
          turnoId: turno.id,
          version: 0,
          realizadoPor: viewer.id,
          anterior: null,
          posterior: turno.notasMedico,
        },
      });
    return { id: turno.id };
  });
}
