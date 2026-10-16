import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pacientePorToken, cancelarTurnoPaciente } from "@/lib/turnos";
import { versionSchema } from "@/lib/validations/comun";
async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const paciente = await pacientePorToken((await params).token);
  const data = z
    .object({ turnoId: z.string().min(1), version: versionSchema })
    .parse(await request.json());
  await cancelarTurnoPaciente({
    ...data,
    pacienteId: paciente.id,
    realizadoPor: `paciente:${paciente.id}`,
  });
  return NextResponse.json({ ok: true });
}

export const POST = conErrores(POSTHandler);
