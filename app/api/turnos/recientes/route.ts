import { NextResponse } from "next/server";
import { conErrores } from "@/lib/errores";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = conErrores(async () => {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;
  const turnos = await prisma.turno.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: {
      id: true,
      fecha: true,
      horaInicio: true,
      estado: true,
      requiereReprogramacion: true,
      paciente: { select: { nombre: true, apellido: true } },
      medico: { select: { apellido: true } },
    },
  });
  return NextResponse.json(turnos);
});
