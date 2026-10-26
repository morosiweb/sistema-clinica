import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { conErrores, ErrorClinica } from "@/lib/errores";
import { permisosPorRol, serializarPermisos } from "@/lib/pantallas";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/lib/validations/comun";
import { passwordSchema } from "@/lib/validations/cuenta";
import { limitarSolicitud } from "@/lib/verificacion";

const accesoSchema = z
  .object({
    email: emailSchema.max(254),
    password: passwordSchema,
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
      select: { email: true, activo: true, versionSesion: true },
    });
  });

  return NextResponse.json(
    { usuario },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}

export const POST = conErrores(POSTHandler);

const cambioSchema = z
  .object({
    password: passwordSchema,
    confirmacion: z.string().max(72),
    versionSesion: z.number().int().nonnegative(),
  })
  .strict()
  .refine((data) => data.password === data.confirmacion, {
    message: "Las contraseñas no coinciden",
  });

export const PATCH = conErrores(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { session, response } = await requireSession(["medicos"]);
    if (!session) return response;
    if (!["ADMIN", "SECRETARIA"].includes(session.user.rol))
      throw new ErrorClinica("Sin acceso", 403);
    const data = cambioSchema.parse(await request.json());
    await limitarSolicitud(`clave-medicos:${session.user.id}`, 20);
    const { id } = await params;
    const cuenta = await prisma.usuarioInterno.findUnique({
      where: { medicoId: id },
      select: { id: true },
    });
    if (!cuenta)
      throw new ErrorClinica(
        "Este médico todavía no tiene acceso al panel",
        404,
      );
    const password = await bcrypt.hash(data.password, 10);
    const usuario = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cuenta:${cuenta.id}`}))`;
      const actual = await tx.usuarioInterno.findUniqueOrThrow({
        where: { id: cuenta.id },
        select: {
          email: true,
          activo: true,
          rol: true,
          medicoId: true,
          versionSesion: true,
        },
      });
      if (actual.rol !== "MEDICO" || actual.medicoId !== id)
        throw new ErrorClinica(
          "Solo se puede cambiar la contraseña de una cuenta médica",
          403,
        );
      if (actual.versionSesion !== data.versionSesion)
        throw new ErrorClinica(
          "La cuenta cambió. Recargá el perfil antes de cambiar la contraseña.",
          409,
        );
      const resultado = await tx.usuarioInterno.updateMany({
        where: {
          id: cuenta.id,
          medicoId: id,
          rol: "MEDICO",
          versionSesion: data.versionSesion,
        },
        data: {
          password,
          versionSesion: { increment: 1 },
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      });
      if (!resultado.count)
        throw new ErrorClinica(
          "La cuenta cambió. Recargá el perfil antes de cambiar la contraseña.",
          409,
        );
      return {
        email: actual.email,
        activo: actual.activo,
        versionSesion: actual.versionSesion + 1,
      };
    });
    return NextResponse.json(
      { usuario },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  },
);
