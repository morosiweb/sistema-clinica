import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";

const VENTANA_CANCELACION_HORAS = 4;

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const paciente = await prisma.paciente.findUnique({ where: { tokenAccesoHash: hashToken(token) } });
  if (!paciente) {
    return NextResponse.json({ error: "Link inválido o vencido." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const turnoId = body?.turnoId;
  if (typeof turnoId !== "string") {
    return NextResponse.json({ error: "Falta turnoId" }, { status: 400 });
  }

  const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
  if (!turno || turno.pacienteId !== paciente.id) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }
  if (turno.estado === "CANCELADO") {
    return NextResponse.json({ error: "Ese turno ya está cancelado" }, { status: 409 });
  }

  const [h, m] = turno.horaInicio.split(":").map(Number);
  const inicioTurno = new Date(turno.fecha);
  inicioTurno.setUTCHours(h, m, 0, 0);
  const horasRestantes = (inicioTurno.getTime() - Date.now()) / (1000 * 60 * 60);
  if (horasRestantes < VENTANA_CANCELACION_HORAS) {
    return NextResponse.json(
      {
        error: `Ya no se puede cancelar online (faltan menos de ${VENTANA_CANCELACION_HORAS} horas). Comunicate con la clínica.`,
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.turno.update({
      where: { id: turnoId },
      data: { estado: "CANCELADO", version: { increment: 1 } },
    });
    await tx.historialTurno.create({
      data: {
        turnoId,
        accion: "CANCELADO",
        realizadoPor: `paciente:${paciente.dni}`,
        detalle: "Cancelado por el paciente desde su link",
      },
    });
  });

  return NextResponse.json({ ok: true });
}
