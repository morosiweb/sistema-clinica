import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { especialidadSchema } from "@/lib/validations/especialidad";

export async function GET() {
  const { session, response } = await requireSession(["especialidades", "medicos", "turnos"]);
  if (!session) return response;

  const especialidades = await prisma.especialidad.findMany({ orderBy: { nombre: "asc" } });
  return NextResponse.json(especialidades);
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession(["especialidades"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = especialidadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existente = await prisma.especialidad.findUnique({ where: { nombre: data.nombre } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe una especialidad con ese nombre" }, { status: 409 });
  }

  const especialidad = await prisma.especialidad.create({
    data: { nombre: data.nombre, descripcion: data.descripcion || null },
  });
  return NextResponse.json(especialidad, { status: 201 });
}
