import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { transaccionAgenda } from "@/lib/transaccion";
import { medicoSchema } from "@/lib/validations/medico";

async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession([
    "medicos",
    "turnos",
    "agenda",
  ]);
  if (!session) return response;

  const { id } = await params;
  const medico = await prisma.medico.findUnique({
    where: { id },
    include: { especialidad: true, horarios: true },
  });
  if (!medico)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(medico);
}

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = medicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const medico = await transaccionAgenda((tx) =>
    tx.medico.update({
      where: { id },
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        matricula: data.matricula || null,
        especialidadId: data.especialidadId,
        telefono: data.telefono || null,
        email: data.email || null,
        duracionTurnoMinutos: data.duracionTurnoMinutos,
        activo: data.activo,
        ...(data.color ? { color: data.color } : {}),
      },
    }),
  );
  return NextResponse.json(medico);
}

export const GET = conErrores(GETHandler);
export const PATCH = conErrores(PATCHHandler);
