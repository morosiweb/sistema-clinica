import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reservaPublicaSchema } from "@/lib/validations/publico";
import { obtenerOCrearPaciente } from "@/lib/pacientes";
import { crearTurno, HorarioOcupadoError } from "@/lib/turnos";
import { enviarConfirmacionTurno } from "@/lib/notificaciones";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = reservaPublicaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // No se puede reservar en el pasado.
  const hoy = new Date().toISOString().slice(0, 10);
  if (data.fecha < hoy) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const { paciente, token } = await obtenerOCrearPaciente(data.dni, {
    nombre: data.nombre,
    apellido: data.apellido,
    telefono: data.telefono,
    email: data.email || null,
  });

  try {
    const turno = await crearTurno({
      pacienteId: paciente.id,
      medicoId: data.medicoId,
      fecha: data.fecha,
      horaInicio: data.horaInicio,
      motivoConsulta: data.motivoConsulta,
      canalReserva: "ONLINE",
      realizadoPor: `paciente:${data.dni}`,
    });

    const medico = await prisma.medico.findUnique({
      where: { id: data.medicoId },
      include: { especialidad: true },
    });
    if (medico) {
      await enviarConfirmacionTurno({
        email: paciente.email,
        nombrePaciente: paciente.nombre,
        fecha: turno.fecha.toISOString(),
        horaInicio: turno.horaInicio,
        medicoNombre: `${medico.nombre} ${medico.apellido}`,
        especialidad: medico.especialidad.nombre,
        token,
      });
    }

    return NextResponse.json({ turno, linkAcceso: `/mi-turno/${token}` }, { status: 201 });
  } catch (e) {
    if (e instanceof HorarioOcupadoError) {
      return NextResponse.json({ error: "Ese horario ya fue tomado, elegí otro." }, { status: 409 });
    }
    throw e;
  }
}
