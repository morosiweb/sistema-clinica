import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> }
) {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;

  const { pagoId } = await params;
  await prisma.pago.delete({ where: { id: pagoId } });
  return NextResponse.json({ ok: true });
}
