import { NextRequest, NextResponse } from "next/server";
import { obtenerSlotsDisponibles } from "@/lib/disponibilidad";

export async function GET(request: NextRequest) {
  const medicoId = request.nextUrl.searchParams.get("medicoId");
  const fecha = request.nextUrl.searchParams.get("fecha");
  if (!medicoId || !fecha) {
    return NextResponse.json({ error: "Faltan medicoId y fecha" }, { status: 400 });
  }
  const slots = await obtenerSlotsDisponibles(medicoId, fecha);
  return NextResponse.json({ slots });
}
