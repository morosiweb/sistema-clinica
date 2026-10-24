import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { conErrores } from "@/lib/errores";
import { procesarAvisosTurno } from "@/lib/avisos-turno";
import { procesarRecordatorios } from "@/lib/recordatorios";
import { procesarAvisosReprogramacion } from "@/lib/avisos-reprogramacion";
import { limitarSolicitud } from "@/lib/verificacion";

export const maxDuration = 60;

export const POST = conErrores(async (request: NextRequest) => {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;
  await limitarSolicitud(`reintento:${session.user.id}`, 20);
  const { id, tipo } = z
    .object({
      id: z.string().min(1).max(100),
      tipo: z.enum(["aviso", "recordatorio", "licencia"]),
    })
    .parse(await request.json());
  const resultado =
    tipo === "aviso"
      ? await procesarAvisosTurno([id])
      : tipo === "recordatorio"
        ? await procesarRecordatorios([id])
        : await procesarAvisosReprogramacion(undefined, 1, [id]);
  return NextResponse.json({
    ...resultado,
    mensaje: resultado.enviados
      ? "Aviso enviado."
      : "El aviso sigue pendiente o ya no corresponde. Revisá el contacto del paciente.",
  });
});
