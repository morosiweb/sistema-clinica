import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { fichaMedicaSchema } from "@/lib/validations/ficha-medica";
import { actualizarFicha } from "@/lib/clinica";
async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["agenda", "pacientes"]);
  if (!session) return response;
  const data = fichaMedicaSchema.parse(await request.json());
  return NextResponse.json(
    await actualizarFicha((await params).id, data, session.user),
  );
}

export const PATCH = conErrores(PATCHHandler);
