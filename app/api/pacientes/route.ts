import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { pacienteSchema } from "@/lib/validations/paciente";
import { generarToken, hashToken } from "@/lib/token";

export async function GET(request: NextRequest) {
  const { session, response } = await requireSession(["pacientes"]);
  if (!session) return response;

  const q = request.nextUrl.searchParams.get("q")?.trim();

  const pacientes = await prisma.paciente.findMany({
    where: q
      ? {
          OR: [
            { dni: { contains: q } },
            { nombre: { contains: q, mode: "insensitive" } },
            { apellido: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { apellido: "asc" },
    take: 50,
  });

  return NextResponse.json(pacientes);
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession(["pacientes"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = pacienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existente = await prisma.paciente.findUnique({ where: { dni: data.dni } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe un paciente con ese DNI" }, { status: 409 });
  }

  const token = generarToken();
  const paciente = await prisma.paciente.create({
    data: {
      dni: data.dni,
      nombre: data.nombre,
      apellido: data.apellido,
      telefono: data.telefono || null,
      email: data.email || null,
      fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
      obraSocial: data.obraSocial || null,
      tokenAccesoHash: hashToken(token),
    },
  });

  return NextResponse.json(paciente, { status: 201 });
}
