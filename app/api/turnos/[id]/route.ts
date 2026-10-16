import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { actualizarTurnoSchema } from "@/lib/validations/turno";
import { enviarCancelacionTurno } from "@/lib/notificaciones";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(["turnos", "agenda"]);
  if (!session) return response;

  const { id } = await params;
  const turno = await prisma.turno.findUnique({
    where: { id },
    include: {
      paciente: true,
      medico: { include: { especialidad: true } },
      historial: { orderBy: { fecha: "desc" } },
    },
  });
  if (!turno) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (session.user.rol === "MEDICO" && turno.medicoId !== session.user.medicoId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  // Las notas clinicas son del medico tratante y de ADMIN; secretaria no
  // accede al contenido (ver lib/historia.ts para el mismo criterio).
  const puedeVerNotasMedico = session.user.rol === "ADMIN" || turno.medicoId === session.user.medicoId;
  return NextResponse.json({ ...turno, notasMedico: puedeVerNotasMedico ? turno.notasMedico : null });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(["turnos", "agenda"]);
  if (!session) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = actualizarTurnoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const actual = await prisma.turno.findUnique({
    where: { id },
    include: { paciente: true, medico: { include: { especialidad: true } } },
  });
  if (!actual) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const esMedicoPropio = session.user.rol === "MEDICO";
  if (esMedicoPropio && actual.medicoId !== session.user.medicoId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  if (actual.version !== data.version) {
    return NextResponse.json(
      { error: "Este turno fue modificado por otra persona, recargá la página." },
      { status: 409 }
    );
  }

  const turno = await prisma.$transaction(async (tx) => {
    // update (no updateMany) exige una clave única en el where; para el
    // chequeo optimista atómico (id + version) hace falta updateMany.
    const resultado = await tx.turno.updateMany({
      where: { id, version: data.version },
      data: {
        estado: data.estado,
        // Un médico solo puede dejar sus propias notas clínicas; las notas
        // internas de secretaria no las puede tocar. Y viceversa: secretaria
        // nunca escribe (ni borra sin querer) el campo clínico del médico.
        ...(esMedicoPropio ? {} : { notasSecretaria: data.notasSecretaria || null }),
        ...(esMedicoPropio ? { notasMedico: data.notasMedico || null } : {}),
        version: { increment: 1 },
      },
    });

    if (resultado.count === 0) {
      throw new Error("VERSION_DESACTUALIZADA");
    }

    await tx.historialTurno.create({
      data: {
        turnoId: id,
        accion: data.estado === "CANCELADO" ? "CANCELADO" : "MODIFICADO",
        realizadoPor: session.user.email ?? session.user.id,
        detalle: `Estado: ${data.estado}`,
      },
    });

    return tx.turno.findUniqueOrThrow({ where: { id } });
  }).catch((e) => {
    if (e instanceof Error && e.message === "VERSION_DESACTUALIZADA") return null;
    throw e;
  });

  if (!turno) {
    return NextResponse.json(
      { error: "Este turno fue modificado por otra persona, recargá la página." },
      { status: 409 }
    );
  }

  // Aviso al paciente solo cuando la clínica (secretaria/admin/médico) es
  // quien cancela desde acá; si el paciente cancela su propio turno vía su
  // link, no tiene sentido avisarle de algo que acaba de hacer él mismo.
  if (data.estado === "CANCELADO" && actual.estado !== "CANCELADO") {
    await enviarCancelacionTurno({
      email: actual.paciente.email,
      nombrePaciente: actual.paciente.nombre,
      fecha: actual.fecha.toISOString(),
      horaInicio: actual.horaInicio,
      medicoNombre: `${actual.medico.nombre} ${actual.medico.apellido}`,
      especialidad: actual.medico.especialidad.nombre,
    });
  }

  return NextResponse.json(turno);
}
