import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recuperarAccesoSchema } from "@/lib/validations/publico";
import { desencriptarToken } from "@/lib/token";
import { enviarLinkPaciente } from "@/lib/notificaciones";

const MENSAJE_GENERICO = "Si los datos coinciden con un registro, te enviamos el link a tu email.";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = recuperarAccesoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dni, contacto } = parsed.data;

  const paciente = await prisma.paciente.findUnique({ where: { dni } });
  const coincide =
    paciente &&
    (paciente.telefono?.trim() === contacto.trim() ||
      paciente.email?.trim().toLowerCase() === contacto.trim().toLowerCase());

  // Nunca revelar si el DNI existe o si el contacto coincide: siempre el
  // mismo mensaje y la misma forma de respuesta, coincida o no.
  if (coincide && paciente) {
    const token = desencriptarToken(paciente.tokenAccesoEnc);
    await enviarLinkPaciente(paciente, `/mi-turno/${token}`);
  }

  return NextResponse.json({ mensaje: MENSAJE_GENERICO });
}
