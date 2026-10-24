import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { pacientePorToken, reprogramarTurno } from "@/lib/turnos";
import { reprogramarTurnoSchema } from "@/lib/validations/publico";
import { prisma } from "@/lib/prisma";
import { resultadoAviso } from "@/lib/avisos-turno";
export const maxDuration = 60;

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const paciente = await pacientePorToken(token);
  const data = reprogramarTurnoSchema.parse(await request.json());
  const turno = await reprogramarTurno({
    ...data,
    pacienteId: paciente.id,
    realizadoPor: `paciente:${paciente.id}`,
  });
  const aviso = await prisma.avisoTurno.findFirstOrThrow({
    where: { turnoId: turno.id, tipo: "SOLICITUD" },
    orderBy: { createdAt: "desc" },
  });
  const notificacion = await resultadoAviso(aviso.id);
  return NextResponse.json({ ok: true, notificacion });
}

export const POST = conErrores(POSTHandler);
