import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";
import { reprogramarTurnoSchema } from "@/lib/validations/publico";
import { reprogramarTurno, HorarioOcupadoError, horasHastaElTurno, VENTANA_MINIMA_HORAS } from "@/lib/turnos";
import { enviarConfirmacionTurno } from "@/lib/notificaciones";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const paciente = await prisma.paciente.findUnique({ where: { tokenAccesoHash: hashToken(token) } });
  if (!paciente) {
    return NextResponse.json({ error: "Link inválido o vencido." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = reprogramarTurnoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const actual = await prisma.turno.findUnique({ where: { id: data.turnoId } });
  if (!actual || actual.pacienteId !== paciente.id) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }
  if (actual.estado === "CANCELADO") {
    return NextResponse.json({ error: "Ese turno ya está cancelado" }, { status: 409 });
  }

  const horasRestantes = horasHastaElTurno(actual.fecha, actual.horaInicio);
  if (horasRestantes < VENTANA_MINIMA_HORAS) {
    return NextResponse.json(
      {
        error: `Ya no se puede reprogramar online (faltan menos de ${VENTANA_MINIMA_HORAS} horas). Comunicate con la clínica.`,
      },
      { status: 400 }
    );
  }

  try {
    const turno = await reprogramarTurno({
      turnoId: data.turnoId,
      medicoId: data.medicoId,
      fecha: data.fecha,
      horaInicio: data.horaInicio,
      realizadoPor: `paciente:${paciente.dni}`,
    });

    await enviarConfirmacionTurno({
      email: paciente.email,
      nombrePaciente: paciente.nombre,
      fecha: turno.fecha.toISOString(),
      horaInicio: turno.horaInicio,
      medicoNombre: `${turno.medico.nombre} ${turno.medico.apellido}`,
      especialidad: turno.medico.especialidad.nombre,
      token,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HorarioOcupadoError) {
      return NextResponse.json({ error: "Ese horario ya fue tomado, elegí otro." }, { status: 409 });
    }
    throw e;
  }
}
