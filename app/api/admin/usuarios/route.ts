import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { usuarioSchema } from "@/lib/validations/usuario";
import { serializarPermisos } from "@/lib/pantallas";

// Permisos por defecto al crear un usuario: null (todas las pantallas) solo
// para ADMIN. Secretaria y médico arrancan acotados a lo que necesitan; el
// admin puede ampliarlos después editando el campo permisos.
function permisosPorDefecto(rol: "ADMIN" | "SECRETARIA" | "MEDICO"): string | null {
  if (rol === "ADMIN") return null;
  if (rol === "SECRETARIA") {
    return serializarPermisos(["pacientes", "turnos", "medicos", "especialidades", "bloqueos", "reportes"]);
  }
  return serializarPermisos(["agenda"]);
}

export async function GET() {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const usuarios = await prisma.usuarioInterno.findMany({
    select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(usuarios);
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const body = await request.json();
  const parsed = usuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existente = await prisma.usuarioInterno.findUnique({ where: { email: data.email } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  if (data.rol !== "MEDICO" && data.medicoId) {
    return NextResponse.json({ error: "Solo un usuario MEDICO puede vincularse a un médico" }, { status: 400 });
  }
  if (data.medicoId) {
    const yaVinculado = await prisma.usuarioInterno.findUnique({ where: { medicoId: data.medicoId } });
    if (yaVinculado) {
      return NextResponse.json({ error: "Ese médico ya tiene un usuario vinculado" }, { status: 409 });
    }
  }

  const passwordTemporal = data.password || crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const usuario = await prisma.usuarioInterno.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password: passwordHash,
      rol: data.rol,
      activo: data.activo,
      medicoId: data.medicoId || null,
      permisos: permisosPorDefecto(data.rol),
    },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  return NextResponse.json({ usuario, passwordTemporal }, { status: 201 });
}
