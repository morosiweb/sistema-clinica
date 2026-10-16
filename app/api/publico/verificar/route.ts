import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { verificarAccesoSchema } from "@/lib/validations/publico";
import {
  comprobarCodigo,
  ERROR_CODIGO,
  limitarSolicitud,
  origenSolicitud,
} from "@/lib/verificacion";
import { transaccionAgenda } from "@/lib/transaccion";
import { desencriptarToken } from "@/lib/token";
async function POSTHandler(request: NextRequest) {
  const data = verificarAccesoSchema.parse(await request.json());
  await limitarSolicitud(`verificar:${origenSolicitud(request)}`, 30);
  const resultado = await transaccionAgenda(async (tx) => {
    const codigo = await comprobarCodigo(
      tx,
      data.verificacionId,
      data.codigo,
      "ACCESO",
    );
    if (!codigo?.pacienteId) return null;
    const paciente = await tx.paciente.findUniqueOrThrow({
      where: { id: codigo.pacienteId },
    });
    await tx.verificacionPaciente.update({
      where: { id: codigo.id },
      data: { consumidoEl: new Date() },
    });
    return {
      linkAcceso: `/mi-turno/${desencriptarToken(paciente.tokenAccesoEnc)}`,
    };
  });
  return resultado
    ? NextResponse.json(resultado)
    : NextResponse.json({ error: ERROR_CODIGO }, { status: 400 });
}

export const POST = conErrores(POSTHandler);
