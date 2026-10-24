import { conErrores } from "@/lib/errores";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { actualizarTurnoSchema } from "@/lib/validations/turno";
import { actualizarTurno } from "@/lib/turnos";
import { turnoParaInterno } from "@/lib/turno-dto";
import { procesarAvisosTurno } from "@/lib/avisos-turno";
export const maxDuration = 60;

async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["turnos", "agenda"]);
  if (!session) return response;
  const turno = await prisma.turno.findUnique({
    where: { id: (await params).id },
    include: {
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          dni: true,
          telefono: true,
        },
      },
      medico: { include: { especialidad: true } },
      historial: { orderBy: { fecha: "desc" }, take: 100 },
    },
  });
  if (!turno)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (session.user.rol === "MEDICO" && turno.medicoId !== session.user.medicoId)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  return NextResponse.json(turnoParaInterno(turno, session.user));
}
async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["turnos", "agenda"]);
  if (!session) return response;
  const data = actualizarTurnoSchema.parse(await request.json());
  const { turno, anterior } = await actualizarTurno(
    (await params).id,
    data,
    session.user,
  );
  if (turno.estado !== anterior.estado)
    after(async () => {
      await procesarAvisosTurno();
    });
  return NextResponse.json(turnoParaInterno(turno, session.user));
}

export const GET = conErrores(GETHandler);
export const PATCH = conErrores(PATCHHandler);
