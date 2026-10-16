import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { medicoAtendioAlPaciente } from "@/lib/pacientes";
import { ErrorClinica } from "@/lib/errores";
async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["agenda", "pacientes"]);
  if (!session) return response;
  const { id } = await params;
  if (
    session.user.rol !== "ADMIN" &&
    !(
      session.user.rol === "MEDICO" &&
      session.user.medicoId &&
      (await medicoAtendioAlPaciente(session.user.medicoId, id))
    )
  )
    throw new ErrorClinica("Sin acceso", 403);
  return NextResponse.json(
    await prisma.revisionFicha.findMany({
      where: { pacienteId: id },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
  );
}

export const GET = conErrores(GETHandler);
