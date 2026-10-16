import { transaccionAgenda } from "@/lib/transaccion";
import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { pacienteSchema } from "@/lib/validations/paciente";
import { pacienteSelectSeguro } from "@/lib/pacientes";

async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["pacientes"]);
  if (!session) return response;

  const { id } = await params;
  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: pacienteSelectSeguro,
  });
  if (!paciente)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(paciente);
}

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["pacientes"]);
  if (!session) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = pacienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const otroConMismoDni = await prisma.paciente.findFirst({
    where: { dni: data.dni, NOT: { id } },
  });
  if (otroConMismoDni) {
    return NextResponse.json(
      { error: "Ya existe otro paciente con ese DNI" },
      { status: 409 },
    );
  }

  const paciente = await transaccionAgenda((tx) =>
    tx.paciente.update({
      where: { id },
      data: {
        dni: data.dni,
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono || null,
        email: data.email || null,
        fechaNacimiento: data.fechaNacimiento
          ? new Date(data.fechaNacimiento)
          : null,
        obraSocial: data.obraSocial || null,
      },
      select: pacienteSelectSeguro,
    }),
  );

  return NextResponse.json(paciente);
}

export const GET = conErrores(GETHandler);
export const PATCH = conErrores(PATCHHandler);
