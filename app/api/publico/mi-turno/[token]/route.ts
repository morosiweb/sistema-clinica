import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const paciente = await prisma.paciente.findUnique({
    where: { tokenAccesoHash: hashToken(token) },
  });
  // Mensaje genérico: nunca revelar si el token existe o no.
  if (!paciente) {
    return NextResponse.json({ error: "Link inválido o vencido." }, { status: 404 });
  }

  const turnos = await prisma.turno.findMany({
    where: { pacienteId: paciente.id },
    include: { medico: { include: { especialidad: true } } },
    orderBy: [{ fecha: "desc" }, { horaInicio: "desc" }],
  });

  return NextResponse.json({
    paciente: {
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      dni: paciente.dni,
    },
    turnos,
  });
}
