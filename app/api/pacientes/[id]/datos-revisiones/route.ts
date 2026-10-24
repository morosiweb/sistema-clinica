import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { conErrores } from "@/lib/errores";
import { prisma } from "@/lib/prisma";
import { paginaSchema } from "@/lib/validations/comun";

export const GET = conErrores(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { session, response } = await requireSession(["pacientes"]);
    if (!session) return response;
    const { id } = await params;
    const pagina = paginaSchema.parse(
      request.nextUrl.searchParams.get("pagina") ?? undefined,
    );
    const revisiones = await prisma.revisionDatosPaciente.findMany({
      where: { pacienteId: id },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 25,
      skip: (pagina - 1) * 25,
    });
    const autores = await prisma.usuarioInterno.findMany({
      where: { id: { in: revisiones.map((r) => r.realizadoPor) } },
      select: { id: true, nombre: true },
    });
    return NextResponse.json(
      revisiones.map((r) => ({
        ...r,
        autor:
          autores.find((a) => a.id === r.realizadoPor)?.nombre ??
          "Personal de la clínica",
      })),
    );
  },
);
