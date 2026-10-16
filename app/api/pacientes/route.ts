import { transaccionAgenda } from "@/lib/transaccion";
import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { paginaSchema } from "@/lib/validations/comun";
import { pacienteSchema } from "@/lib/validations/paciente";
import { crearTokenAcceso, pacienteSelectSeguro } from "@/lib/pacientes";

async function GETHandler(request: NextRequest) {
  const { session, response } = await requireSession(["pacientes", "turnos"]);
  if (!session) return response;

  const pagina = paginaSchema.parse(
    request.nextUrl.searchParams.get("pagina") ?? undefined,
  );
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
    // Nunca traer tokenAccesoHash/tokenAccesoEnc acá: esto se devuelve tal
    // cual al cliente (búsqueda de pacientes en el alta de turno).
    select: pacienteSelectSeguro,
    orderBy: { apellido: "asc" },
    take: 50,
    skip: (pagina - 1) * 50,
  });

  return NextResponse.json(pacientes);
}

async function POSTHandler(request: NextRequest) {
  const { session, response } = await requireSession(["pacientes"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = pacienteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existente = await prisma.paciente.findUnique({
    where: { dni: data.dni },
  });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe un paciente con ese DNI" },
      { status: 409 },
    );
  }

  const { tokenAccesoHash, tokenAccesoEnc } = crearTokenAcceso();
  const paciente = await transaccionAgenda((tx) =>
    tx.paciente.create({
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
        tokenAccesoHash,
        tokenAccesoEnc,
      },
      select: pacienteSelectSeguro,
    }),
  );

  return NextResponse.json(paciente, { status: 201 });
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
