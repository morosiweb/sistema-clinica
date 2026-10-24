import { limitarSolicitud, origenSolicitud } from "@/lib/verificacion";
import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import {
  obtenerProximaDisponibilidad,
  obtenerSlotsDisponibles,
} from "@/lib/disponibilidad";

async function GETHandler(request: NextRequest) {
  const medicoId = request.nextUrl.searchParams.get("medicoId");
  const fecha = request.nextUrl.searchParams.get("fecha");
  if (!medicoId || !fecha) {
    return NextResponse.json(
      { error: "Faltan medicoId y fecha" },
      { status: 400 },
    );
  }
  if (request.nextUrl.searchParams.get("proxima") === "1") {
    await limitarSolicitud(`proxima:${origenSolicitud(request)}`, 30);
    return NextResponse.json({
      proxima: await obtenerProximaDisponibilidad(medicoId, fecha),
    });
  }
  const slots = await obtenerSlotsDisponibles(medicoId, fecha);
  return NextResponse.json({ slots });
}

export const GET = conErrores(GETHandler);
