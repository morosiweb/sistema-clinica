import { after, NextRequest, NextResponse } from "next/server";
import { conErrores } from "@/lib/errores";
import { recuperarCuentaSchema } from "@/lib/validations/cuenta";
import { solicitarRecuperacion } from "@/lib/cuenta";
import { limitarSolicitud, origenSolicitud } from "@/lib/verificacion";
export const POST = conErrores(async (request: NextRequest) => {
  const { email } = recuperarCuentaSchema.parse(await request.json());
  await limitarSolicitud(`recuperar-cuenta:ip:${origenSolicitud(request)}`, 10);
  await limitarSolicitud(`recuperar-cuenta:email:${email}`, 3);
  after(async () => {
    await solicitarRecuperacion(email);
  });
  return NextResponse.json({
    mensaje:
      "Si el email corresponde a una cuenta activa, recibirá un enlace para elegir una nueva contraseña. Si no llega, comunicate con administración.",
  });
});
