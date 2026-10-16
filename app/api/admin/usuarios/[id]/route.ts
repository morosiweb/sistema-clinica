import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { usuarioSchema } from "@/lib/validations/usuario";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = usuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const otroConMismoEmail = await prisma.usuarioInterno.findFirst({
    where: { email: data.email, NOT: { id } },
  });
  if (otroConMismoEmail) {
    return NextResponse.json({ error: "Ya existe otro usuario con ese email" }, { status: 409 });
  }

  const usuario = await prisma.usuarioInterno.update({
    where: { id },
    data: {
      nombre: data.nombre,
      email: data.email,
      rol: data.rol,
      activo: data.activo,
      ...(data.password
        ? { password: await bcrypt.hash(data.password, 10), intentosFallidos: 0, bloqueadoHasta: null }
        : {}),
    },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  return NextResponse.json(usuario);
}
