import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { transaccionAgenda } from "@/lib/transaccion";
import { ErrorClinica } from "@/lib/errores";
async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; horarioId: string }> },
) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;
  const { id: medicoId, horarioId } = await params;
  await transaccionAgenda(async (tx) => {
    const resultado = await tx.horarioMedico.deleteMany({
      where: { id: horarioId, medicoId },
    });
    if (!resultado.count) throw new ErrorClinica("Horario no encontrado", 404);
  });
  return NextResponse.json({ ok: true });
}

export const DELETE = conErrores(DELETEHandler);
