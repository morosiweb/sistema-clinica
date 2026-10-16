import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { medicoSchema } from "@/lib/validations/medico";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(["medicos", "turnos", "agenda"]);
  if (!session) return response;

  const { id } = await params;
  const medico = await prisma.medico.findUnique({
    where: { id },
    include: { especialidad: true, horarios: true },
  });
  if (!medico) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(medico);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = medicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const medico = await prisma.medico.update({
    where: { id },
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
  return NextResponse.json(medico);
}
