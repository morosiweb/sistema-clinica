import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pacientePorToken } from "@/lib/turnos";
import { paginaSchema } from "@/lib/validations/comun";
import { turnoPublicoSelect } from "@/lib/turno-dto";
async function GETHandler(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const paciente = await pacientePorToken((await params).token);
  const pagina = paginaSchema.parse(
    request.nextUrl.searchParams.get("pagina") ?? undefined,
  );
  const turnos = await prisma.turno.findMany({
    where: { pacienteId: paciente.id },
    select: turnoPublicoSelect,
    orderBy: [{ fecha: "desc" }, { horaInicio: "desc" }, { id: "asc" }],
    skip: (pagina - 1) * 50,
    take: 51,
  });
  const turnoId = request.nextUrl.searchParams.get("turnoId");
  const turnoDestacado =
    turnoId && turnoId.length <= 100
      ? await prisma.turno.findFirst({
          where: { id: turnoId, pacienteId: paciente.id },
          select: turnoPublicoSelect,
        })
      : null;
  return NextResponse.json({
    paciente: {
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      dni: paciente.dni,
    },
    turnos: turnos.slice(0, 50),
    hayMas: turnos.length > 50,
    turnoDestacado,
  });
}

export const GET = conErrores(GETHandler);
