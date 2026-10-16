import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { crearTurnoSchema } from "@/lib/validations/turno";
import { crearTurno, HorarioOcupadoError } from "@/lib/turnos";

export async function GET(request: NextRequest) {
  const { session, response } = await requireSession(["turnos", "agenda"]);
  if (!session) return response;

  const fecha = request.nextUrl.searchParams.get("fecha");
  const medicoId = request.nextUrl.searchParams.get("medicoId");

  // Un MEDICO solo puede ver su propia agenda, salvo que tenga permiso de "turnos".
  const esSoloAgenda = session.user.rol === "MEDICO";

  const turnos = await prisma.turno.findMany({
    where: {
      ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
      ...(medicoId ? { medicoId } : {}),
      ...(esSoloAgenda ? { medicoId: session.user.medicoId ?? "__ninguno__" } : {}),
    },
    include: {
      paciente: { select: { id: true, nombre: true, apellido: true, dni: true, telefono: true } },
      medico: { include: { especialidad: true } },
    },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });

  return NextResponse.json(turnos);
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = crearTurnoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const turno = await crearTurno({
      pacienteId: data.pacienteId,
      medicoId: data.medicoId,
      fecha: data.fecha,
      horaInicio: data.horaInicio,
      motivoConsulta: data.motivoConsulta,
      canalReserva: "PRESENCIAL",
      realizadoPor: session.user.email ?? session.user.id,
    });
    return NextResponse.json(turno, { status: 201 });
  } catch (e) {
    if (e instanceof HorarioOcupadoError) {
      return NextResponse.json({ error: "Ese horario ya fue tomado, elegí otro." }, { status: 409 });
    }
    throw e;
  }
}
