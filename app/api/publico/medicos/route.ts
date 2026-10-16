import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const especialidadId = request.nextUrl.searchParams.get("especialidadId");
  const medicos = await prisma.medico.findMany({
    where: { activo: true, ...(especialidadId ? { especialidadId } : {}) },
    include: { especialidad: true },
    orderBy: { apellido: "asc" },
  });
  return NextResponse.json(medicos);
}
