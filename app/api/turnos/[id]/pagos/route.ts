import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { pagoSchema } from "@/lib/validations/pago";

// Facturación es tarea de secretaria/admin, no del médico: se pide el
// permiso "turnos" específicamente (no "agenda").
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;

  const { id: turnoId } = await params;
  const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
  if (!turno) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = pagoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const pago = await prisma.pago.create({
    data: {
      turnoId,
      monto: data.monto,
      metodo: data.metodo,
      notas: data.notas || null,
      registradoPor: session.user.email ?? session.user.id,
    },
  });

  return NextResponse.json(pago, { status: 201 });
}
