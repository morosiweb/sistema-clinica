import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { recuperarAccesoSchema } from "@/lib/validations/publico";
import { solicitarCodigo, origenSolicitud } from "@/lib/verificacion";
async function POSTHandler(request: NextRequest) {
  const { dni } = recuperarAccesoSchema.parse(await request.json());
  return NextResponse.json(
    await solicitarCodigo(dni, undefined, "ACCESO", origenSolicitud(request)),
  );
}

export const POST = conErrores(POSTHandler);
