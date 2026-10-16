import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function GETHandler(request: NextRequest) {
  const especialidadId = request.nextUrl.searchParams.get("especialidadId");
  const medicos = await prisma.medico.findMany({
    where: { activo: true, ...(especialidadId ? { especialidadId } : {}) },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      especialidad: { select: { id: true, nombre: true } },
    },
    orderBy: { apellido: "asc" },
  });
  return NextResponse.json(medicos);
}

export const GET = conErrores(GETHandler);
