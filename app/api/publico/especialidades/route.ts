import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const especialidades = await prisma.especialidad.findMany({
    where: { medicos: { some: { activo: true } } },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(especialidades);
}
