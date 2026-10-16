import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";
import { crearTokenAcceso } from "@/lib/pacientes";

async function POSTHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const paciente = await prisma.paciente.findUnique({
    where: { tokenAccesoHash: hashToken(token) },
  });
  if (!paciente) {
    return NextResponse.json(
      { error: "Link inválido o vencido." },
      { status: 404 },
    );
  }

  const {
    token: nuevoToken,
    tokenAccesoHash,
    tokenAccesoEnc,
  } = crearTokenAcceso();
  await prisma.paciente.update({
    where: { id: paciente.id, tokenAccesoHash: paciente.tokenAccesoHash },
    data: { tokenAccesoHash, tokenAccesoEnc, tokenGeneradoEl: new Date() },
  });

  return NextResponse.json({ linkAcceso: `/mi-turno/${nuevoToken}` });
}

export const POST = conErrores(POSTHandler);
