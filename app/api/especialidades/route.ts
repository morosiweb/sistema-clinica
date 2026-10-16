import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { especialidadSchema } from "@/lib/validations/especialidad";

async function GETHandler() {
  const { session, response } = await requireSession([
    "especialidades",
    "medicos",
    "turnos",
  ]);
  if (!session) return response;

  const especialidades = await prisma.especialidad.findMany({
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(especialidades);
}

async function POSTHandler(request: NextRequest) {
  const { session, response } = await requireSession(["especialidades"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = especialidadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existente = await prisma.especialidad.findUnique({
    where: { nombre: data.nombre },
  });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe una especialidad con ese nombre" },
      { status: 409 },
    );
  }

  const especialidad = await prisma.especialidad.create({
    data: { nombre: data.nombre, descripcion: data.descripcion || null },
  });
  return NextResponse.json(especialidad, { status: 201 });
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
