import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rangoSchema } from "@/lib/validations/comun";
import { requireSession } from "@/lib/api-auth";

// Alimenta el calendario visual (secretaria: todos los medicos o los que
// elija filtrar; medico: fijo a su propia agenda, ignorando medicoIds).
async function GETHandler(request: NextRequest) {
  const { session, response } = await requireSession(["turnos", "agenda"]);
  if (!session) return response;

  const desde = request.nextUrl.searchParams.get("desde");
  const hasta = request.nextUrl.searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json(
      { error: "Faltan desde y hasta" },
      { status: 400 },
    );
  }

  rangoSchema.parse({ desde, hasta });
  if ((Date.parse(hasta) - Date.parse(desde)) / 86400000 > 31)
    return NextResponse.json(
      { error: "Elegí un rango de hasta 31 días" },
      { status: 400 },
    );

  const medicoIdsParam = request.nextUrl.searchParams.get("medicoIds");
  const medicoIds = medicoIdsParam
    ? medicoIdsParam.split(",").filter(Boolean)
    : null;

  const esSoloAgenda = session.user.rol === "MEDICO";

  const turnos = await prisma.turno.findMany({
    where: {
      fecha: {
        gte: new Date(`${desde}T00:00:00.000Z`),
        lte: new Date(`${hasta}T00:00:00.000Z`),
      },
      ...(esSoloAgenda
        ? { medicoId: session.user.medicoId ?? "__ninguno__" }
        : medicoIds
          ? { medicoId: { in: medicoIds } }
          : {}),
    },
    include: {
      paciente: { select: { nombre: true, apellido: true } },
      medico: true,
    },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });

  return NextResponse.json(
    turnos.map((t) => ({
      id: t.id,
      medicoId: t.medicoId,
      medicoNombre: `${t.medico.apellido}, ${t.medico.nombre}`,
      pacienteNombre: `${t.paciente.apellido}, ${t.paciente.nombre}`,
      fecha: t.fecha.toISOString(),
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      estado: t.estado,
    })),
  );
}

export const GET = conErrores(GETHandler);
