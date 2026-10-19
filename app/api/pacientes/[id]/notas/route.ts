import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { conErrores } from "@/lib/errores";
import {
  comprobarAccesoPaciente,
  notaPacienteSelect,
} from "@/lib/documentacion-paciente";
import { paginaSchema } from "@/lib/validations/comun";

type Contexto = { params: Promise<{ id: string }> };
async function GETHandler(request: NextRequest, { params }: Contexto) {
  const { session, response } = await requireSession(["pacientes", "agenda"]);
  if (!session) return response;
  const { id } = await params;
  await comprobarAccesoPaciente(id, session.user);
  const pagina = paginaSchema.parse(
    request.nextUrl.searchParams.get("pagina") ?? undefined,
  );
  return NextResponse.json(
    await prisma.notaPaciente.findMany({
      where: { pacienteId: id },
      select: notaPacienteSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * 25,
      take: 25,
    }),
  );
}
async function POSTHandler(request: NextRequest, { params }: Contexto) {
  const { session, response } = await requireSession(["pacientes", "agenda"]);
  if (!session) return response;
  const { id } = await params;
  await comprobarAccesoPaciente(id, session.user);
  const { contenido } = z
    .object({
      contenido: z.string().trim().min(1, "Escribí una nota").max(10000),
    })
    .parse(await request.json());
  return NextResponse.json(
    await prisma.notaPaciente.create({
      data: { pacienteId: id, autorId: session.user.id, contenido },
      select: notaPacienteSelect,
    }),
    { status: 201 },
  );
}
export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
