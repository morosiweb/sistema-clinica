import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ErrorClinica } from "@/lib/errores";
async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["agenda", "turnos"]);
  if (!session) return response;
  const { id } = await params;
  const turno = await prisma.turno.findUnique({
    where: { id },
    select: { medicoId: true },
  });
  if (!turno) throw new ErrorClinica("Turno no encontrado", 404);
  if (
    session.user.rol !== "ADMIN" &&
    !(session.user.rol === "MEDICO" && session.user.medicoId === turno.medicoId)
  )
    throw new ErrorClinica("Sin acceso", 403);
  return NextResponse.json(
    await prisma.revisionNota.findMany({
      where: { turnoId: id },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
  );
}

export const GET = conErrores(GETHandler);
