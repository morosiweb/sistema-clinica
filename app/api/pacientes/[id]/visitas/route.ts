import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { nuevaVisitaSchema } from "@/lib/validations/ficha-medica";
import { registrarVisita } from "@/lib/clinica";
async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["agenda", "pacientes"]);
  if (!session) return response;
  const data = nuevaVisitaSchema.parse(await request.json());
  return NextResponse.json(
    await registrarVisita((await params).id, data, session.user),
  );
}

export const POST = conErrores(POSTHandler);
