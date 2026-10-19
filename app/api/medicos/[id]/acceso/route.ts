import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { conErrores, ErrorClinica } from "@/lib/errores";
import { permisosPorRol, serializarPermisos } from "@/lib/pantallas";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/lib/validations/comun";

const accesoSchema = z
  .object({
    email: emailSchema.max(254),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(72, "La contraseña es demasiado larga")
      .refine((valor) => Buffer.byteLength(valor, "utf8") <= 72, {
        message: "La contraseña es demasiado larga; usá menos caracteres",
      }),
  })
  .strict();

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;
  if (!["ADMIN", "SECRETARIA"].includes(session.user.rol)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { email, password: passwordInicial } = accesoSchema.parse(
    await request.json(),
  );
  const { id } = await params;
  const password = await bcrypt.hash(passwordInicial, 10);

  const usuario = await prisma.$transaction(async (tx) => {
    const medico = await tx.medico.findUnique({
      where: { id },
      select: {
        nombre: true,
        apellido: true,
        activo: true,
        usuarioInterno: { select: { id: true } },
      },
    });
    if (!medico) throw new ErrorClinica("Médico no encontrado", 404);
    if (!medico.activo)
      throw new ErrorClinica("Activá al médico antes de crear su acceso");
    if (medico.usuarioInterno)
      throw new ErrorClinica("Este médico ya tiene un usuario vinculado", 409);

    const existente = await tx.usuarioInterno.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existente)
      throw new ErrorClinica("Ya existe un usuario con ese email", 409);

    return tx.usuarioInterno.create({
      data: {
        nombre: `${medico.nombre} ${medico.apellido}`,
        email,
        password,
        rol: "MEDICO",
        activo: true,
        medicoId: id,
        permisos: serializarPermisos(permisosPorRol("MEDICO")),
      },
      select: { email: true, activo: true },
    });
  });

  return NextResponse.json(
    { usuario },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}

export const POST = conErrores(POSTHandler);
