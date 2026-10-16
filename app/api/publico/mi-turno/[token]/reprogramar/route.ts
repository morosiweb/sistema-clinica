import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { pacientePorToken, reprogramarTurno } from "@/lib/turnos";
import { reprogramarTurnoSchema } from "@/lib/validations/publico";
import { enviarConfirmacionTurno } from "@/lib/notificaciones";
async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const paciente = await pacientePorToken(token);
  const data = reprogramarTurnoSchema.parse(await request.json());
  const turno = await reprogramarTurno({
    ...data,
    pacienteId: paciente.id,
    realizadoPor: `paciente:${paciente.id}`,
  });
  const correoEnviado = await enviarConfirmacionTurno({
    email: paciente.email,
    nombrePaciente: paciente.nombre,
    fecha: turno.fecha.toISOString(),
    horaInicio: turno.horaInicio,
    medicoNombre: `${turno.medico.nombre} ${turno.medico.apellido}`,
    especialidad: turno.medico.especialidad.nombre,
    token,
  });
  return NextResponse.json({ ok: true, correoEnviado });
}

export const POST = conErrores(POSTHandler);
