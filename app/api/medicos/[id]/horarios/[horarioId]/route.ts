import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; horarioId: string }> }
) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;

  const { horarioId } = await params;
  await prisma.horarioMedico.delete({ where: { id: horarioId } });
  return NextResponse.json({ ok: true });
}
