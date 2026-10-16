import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { nuevaVisitaSchema } from "@/lib/validations/ficha-medica";
import { sumarMinutos } from "@/lib/turnos";

// Permite al médico registrar una consulta ya realizada directamente desde
// la ficha del paciente (ej. una visita presencial que no pasó por el
// circuito de reserva). No valida solapamiento de agenda a propósito: es
// un registro de algo que ya ocurrió, no la reserva de un horario futuro.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { activo: true, rol: true, medicoId: true },
  });
  if (!usuario || !usuario.activo || usuario.rol !== "MEDICO" || !usuario.medicoId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { id: pacienteId } = await params;
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = nuevaVisitaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const medico = await prisma.medico.findUniqueOrThrow({ where: { id: usuario.medicoId } });
  const horaFin = sumarMinutos(data.horaInicio, medico.duracionTurnoMinutos);

  const turno = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.turno.create({
      data: {
        pacienteId,
        medicoId: usuario.medicoId!,
        fecha: new Date(`${data.fecha}T00:00:00.000Z`),
        horaInicio: data.horaInicio,
        horaFin,
        estado: "ATENDIDO",
        canalReserva: "PRESENCIAL",
        motivoConsulta: data.motivoConsulta || null,
        notasMedico: data.notasMedico || null,
      },
    });
    await tx.historialTurno.create({
      data: {
        turnoId: nuevo.id,
        accion: "CREADO",
        realizadoPor: session.user.email ?? session.user.id,
        detalle: "Visita registrada directamente desde la ficha del paciente",
      },
    });
    return nuevo;
  });

  return NextResponse.json(turno, { status: 201 });
}
