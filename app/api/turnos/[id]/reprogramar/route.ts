import { after, NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { conErrores, ErrorClinica } from "@/lib/errores";
import { reprogramarTurnoSchema } from "@/lib/validations/publico";
import { prisma } from "@/lib/prisma";
import { reprogramarTurno } from "@/lib/turnos";
import { procesarAvisosTurno } from "@/lib/avisos-turno";

export const maxDuration = 60;

export const POST = conErrores(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { session, response } = await requireSession(["turnos"]);
    if (!session) return response;
    if (session.user.rol === "MEDICO")
      throw new ErrorClinica("Sin acceso", 403);
    const { id } = await params;
    const data = reprogramarTurnoSchema.parse({
      ...(await request.json()),
      turnoId: id,
    });
    const actual = await prisma.turno.findUniqueOrThrow({
      where: { id },
      select: { pacienteId: true },
    });
    const turno = await reprogramarTurno({
      ...data,
      pacienteId: actual.pacienteId,
      realizadoPor: session.user.id,
      interno: true,
    });
    after(async () => {
      await procesarAvisosTurno();
    });
    return NextResponse.json({
      id: turno.id,
      version: turno.version,
      fecha: turno.fecha,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      medicoId: turno.medicoId,
      medico: turno.medico,
      estado: turno.estado,
      requiereReprogramacion: turno.requiereReprogramacion,
    });
  },
);
