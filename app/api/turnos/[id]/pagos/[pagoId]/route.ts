import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { ErrorClinica } from "@/lib/errores";
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> },
) {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;
  const { motivo } = z
    .object({
      motivo: z
        .string()
        .trim()
        .min(5, "Explicá el motivo de la anulación")
        .max(300),
    })
    .parse(await request.json());
  const { id: turnoId, pagoId } = await params;
  const resultado = await prisma.pago.updateMany({
    where: { id: pagoId, turnoId, anuladoEl: null },
    data: {
      anuladoEl: new Date(),
      anuladoPor: session.user.id,
      motivoAnulacion: motivo,
    },
  });
  if (!resultado.count)
    throw new ErrorClinica("Pago no encontrado o ya anulado", 409);
  return NextResponse.json({ ok: true });
}

export const DELETE = conErrores(DELETEHandler);
