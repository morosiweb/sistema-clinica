import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { usuarioSchema } from "@/lib/validations/usuario";
import { serializarPermisos, permisosPorRol } from "@/lib/pantallas";

async function GETHandler() {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const usuarios = await prisma.usuarioInterno.findMany({
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      createdAt: true,
    },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(usuarios);
}

async function POSTHandler(request: NextRequest) {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const body = await request.json();
  const parsed = usuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existente = await prisma.usuarioInterno.findFirst({
    where: { email: { equals: data.email, mode: "insensitive" } },
  });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email" },
      { status: 409 },
    );
  }

  if (data.rol !== "MEDICO" && data.medicoId) {
    return NextResponse.json(
      { error: "Solo un usuario MEDICO puede vincularse a un médico" },
      { status: 400 },
    );
  }
  if (data.medicoId) {
    const yaVinculado = await prisma.usuarioInterno.findUnique({
      where: { medicoId: data.medicoId },
    });
    if (yaVinculado) {
      return NextResponse.json(
        { error: "Ese médico ya tiene un usuario vinculado" },
        { status: 409 },
      );
    }
  }

  const passwordTemporal =
    data.password || crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const usuario = await prisma.usuarioInterno.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password: passwordHash,
      rol: data.rol,
      activo: data.activo,
      medicoId: data.medicoId || null,
      permisos:
        data.rol === "ADMIN"
          ? null
          : serializarPermisos(data.permisos ?? permisosPorRol(data.rol)),
    },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  return NextResponse.json({ usuario, passwordTemporal }, { status: 201 });
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
