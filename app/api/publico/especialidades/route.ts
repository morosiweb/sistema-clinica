import { conErrores } from "@/lib/errores";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function GETHandler() {
  const especialidades = await prisma.especialidad.findMany({
    where: { medicos: { some: { activo: true } } },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(especialidades);
}

export const GET = conErrores(GETHandler);
