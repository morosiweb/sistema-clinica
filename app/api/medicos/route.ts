import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { medicoSchema } from "@/lib/validations/medico";
import { COLORES_MEDICOS } from "@/lib/colores-medicos";

async function GETHandler() {
  const { session, response } = await requireSession([
    "medicos",
    "turnos",
    "agenda",
  ]);
  if (!session) return response;

  const medicos = await prisma.medico.findMany({
    include: { especialidad: true },
    orderBy: { apellido: "asc" },
  });
  return NextResponse.json(medicos);
}

async function POSTHandler(request: NextRequest) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = medicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const existentes = await prisma.medico.findMany({ select: { color: true } });
  const color =
    data.color ||
    COLORES_MEDICOS.find((c) => !existentes.some((m) => m.color === c)) ||
    COLORES_MEDICOS[existentes.length % COLORES_MEDICOS.length];

  const medico = await prisma.medico.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      matricula: data.matricula || null,
      especialidadId: data.especialidadId,
      telefono: data.telefono || null,
      email: data.email || null,
      duracionTurnoMinutos: data.duracionTurnoMinutos,
      activo: data.activo,
      color,
    },
  });
  return NextResponse.json(medico, { status: 201 });
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
