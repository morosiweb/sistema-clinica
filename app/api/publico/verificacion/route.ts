import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { solicitarCodigoSchema } from "@/lib/validations/publico";
import { solicitarCodigo, origenSolicitud } from "@/lib/verificacion";
async function POSTHandler(request: NextRequest) {
  const data = solicitarCodigoSchema.parse(await request.json());
  return NextResponse.json(
    await solicitarCodigo(
      data.dni,
      data.email,
      "RESERVA",
      origenSolicitud(request),
    ),
  );
}

export const POST = conErrores(POSTHandler);
