import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { transaccionAgenda } from "@/lib/transaccion";
import { validarBloqueo } from "@/lib/bloqueos";
import { ErrorClinica } from "@/lib/errores";
async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["bloqueos", "medicos"]);
  if (!session) return response;
  if (session.user.rol === "MEDICO")
    throw new ErrorClinica(
      "La licencia debe resolverla secretaría o administración",
      403,
    );
  const { estado } = z
    .object({ estado: z.enum(["APROBADO", "RECHAZADO"]) })
    .parse(await request.json());
  const id = (await params).id;
  const resultado = await transaccionAgenda(async (tx) => {
    const actual = await tx.bloqueoMedico.findUniqueOrThrow({ where: { id } });
    if (actual.estado !== "PENDIENTE")
      throw new ErrorClinica("La solicitud ya fue resuelta", 409);
    if (estado === "APROBADO")
      await validarBloqueo(tx, {
        ...actual,
        fecha: actual.fecha.toISOString().slice(0, 10),
      });
    return tx.bloqueoMedico.update({
      where: { id },
      data: { estado, aprobadoPorId: session.user.id },
    });
  });
  return NextResponse.json(resultado);
}

export const PATCH = conErrores(PATCHHandler);

async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["bloqueos", "medicos"]);
  if (!session) return response;
  if (session.user.rol === "MEDICO")
    throw new ErrorClinica("Debe resolverlo secretaría o administración", 403);
  const { id } = await params;
  // Se conserva la ausencia como rechazada para no borrar su registro.
  await transaccionAgenda((tx) =>
    tx.bloqueoMedico.update({
      where: { id },
      data: { estado: "RECHAZADO", aprobadoPorId: session.user.id },
    }),
  );
  return NextResponse.json({ ok: true });
}
export const DELETE = conErrores(DELETEHandler);
