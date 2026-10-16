import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { medicoSchema } from "@/lib/validations/medico";

export async function GET() {
  const { session, response } = await requireSession(["medicos", "turnos", "agenda"]);
  if (!session) return response;

  const medicos = await prisma.medico.findMany({
    include: { especialidad: true },
    orderBy: { apellido: "asc" },
  });
  return NextResponse.json(medicos);
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = medicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

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
    },
  });
  return NextResponse.json(medico, { status: 201 });
}
