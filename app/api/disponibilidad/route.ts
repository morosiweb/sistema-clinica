import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { obtenerSlotsDisponibles } from "@/lib/disponibilidad";

async function GETHandler(request: NextRequest) {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;

  const medicoId = request.nextUrl.searchParams.get("medicoId");
  const fecha = request.nextUrl.searchParams.get("fecha");
  if (!medicoId || !fecha) {
    return NextResponse.json(
      { error: "Faltan medicoId y fecha" },
      { status: 400 },
    );
  }

  const slots = await obtenerSlotsDisponibles(medicoId, fecha);
  return NextResponse.json({ slots });
}

export const GET = conErrores(GETHandler);
