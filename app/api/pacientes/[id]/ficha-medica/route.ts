import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fichaMedicaSchema } from "@/lib/validations/ficha-medica";
import { medicoAtendioAlPaciente } from "@/lib/pacientes";

// No usa requireSession(["pacientes"]) a propósito: un médico sin ese
// permiso igual puede editar la ficha médica de SUS pacientes, pero no
// la ficha administrativa (dni/telefono/etc.), que sigue siendo de
// secretaria/admin vía /api/pacientes/[id].
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { activo: true, rol: true, medicoId: true },
  });
  if (!usuario || !usuario.activo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const esAdmin = usuario.rol === "ADMIN";
  const esMedicoTratante = usuario.rol === "MEDICO" && usuario.medicoId
    ? await medicoAtendioAlPaciente(usuario.medicoId, id)
    : false;
  if (!esAdmin && !esMedicoTratante) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = fichaMedicaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const paciente = await prisma.paciente.update({
    where: { id },
    data: {
      pesoKg: data.pesoKg,
      alturaCm: data.alturaCm,
      grupoSanguineo: data.grupoSanguineo || null,
      alergias: data.alergias || null,
      antecedentes: data.antecedentes || null,
    },
  });

  return NextResponse.json(paciente);
}
