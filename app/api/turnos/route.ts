import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { crearTurnoSchema } from "@/lib/validations/turno";

function sumarMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

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
    include: { paciente: true, medico: { include: { especialidad: true } } },
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

  const medico = await prisma.medico.findUnique({ where: { id: data.medicoId } });
  if (!medico) return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });

  const fecha = new Date(`${data.fecha}T00:00:00.000Z`);
  const horaFin = sumarMinutos(data.horaInicio, medico.duracionTurnoMinutos);

  try {
    const turno = await prisma.$transaction(async (tx) => {
      const solapado = await tx.turno.findFirst({
        where: {
          medicoId: data.medicoId,
          fecha,
          estado: { not: "CANCELADO" },
          horaInicio: { lt: horaFin },
          horaFin: { gt: data.horaInicio },
        },
      });
      if (solapado) {
        throw new Error("HORARIO_OCUPADO");
      }

      const nuevo = await tx.turno.create({
        data: {
          pacienteId: data.pacienteId,
          medicoId: data.medicoId,
          fecha,
          horaInicio: data.horaInicio,
          horaFin,
          motivoConsulta: data.motivoConsulta || null,
          canalReserva: "PRESENCIAL",
        },
      });

      await tx.historialTurno.create({
        data: {
          turnoId: nuevo.id,
          accion: "CREADO",
          realizadoPor: session.user.email ?? session.user.id,
        },
      });

      return nuevo;
    });

    return NextResponse.json(turno, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "HORARIO_OCUPADO") {
      return NextResponse.json({ error: "Ese horario ya fue tomado, elegí otro." }, { status: 409 });
    }
    throw e;
  }
}
