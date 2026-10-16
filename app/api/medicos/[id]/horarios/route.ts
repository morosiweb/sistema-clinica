import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { horarioSchema } from "@/lib/validations/medico";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;

  const { id: medicoId } = await params;
  const body = await request.json();
  const parsed = horarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.horaInicio >= data.horaFin) {
    return NextResponse.json({ error: "La hora de inicio debe ser anterior a la de fin" }, { status: 400 });
  }

  const horario = await prisma.horarioMedico.create({
    data: {
      medicoId,
      diaSemana: data.diaSemana,
      horaInicio: data.horaInicio,
      horaFin: data.horaFin,
    },
  });
  return NextResponse.json(horario, { status: 201 });
}
