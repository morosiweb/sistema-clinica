import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { especialidadSchema } from "@/lib/validations/especialidad";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(["especialidades"]);
  if (!session) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = especialidadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const otraConMismoNombre = await prisma.especialidad.findFirst({
    where: { nombre: data.nombre, NOT: { id } },
  });
  if (otraConMismoNombre) {
    return NextResponse.json({ error: "Ya existe otra especialidad con ese nombre" }, { status: 409 });
  }

  const especialidad = await prisma.especialidad.update({
    where: { id },
    data: { nombre: data.nombre, descripcion: data.descripcion || null },
  });
  return NextResponse.json(especialidad);
}
