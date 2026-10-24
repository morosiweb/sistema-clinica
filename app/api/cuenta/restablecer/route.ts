import { NextRequest, NextResponse } from "next/server";
import { conErrores } from "@/lib/errores";
import { restablecerCuentaSchema } from "@/lib/validations/cuenta";
import { restablecerClave } from "@/lib/cuenta";
import { limitarSolicitud, origenSolicitud } from "@/lib/verificacion";
export const POST = conErrores(async (request: NextRequest) => {
  await limitarSolicitud(`restablecer:${origenSolicitud(request)}`, 10);
  const { token, nueva } = restablecerCuentaSchema.parse(await request.json());
  await restablecerClave(token, nueva);
  return NextResponse.json({ ok: true });
});
