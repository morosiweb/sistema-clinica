import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { procesarRecordatorios } from "@/lib/recordatorios";
import { procesarAvisosReprogramacion } from "@/lib/avisos-reprogramacion";
export const maxDuration = 60;

// Vercel Cron llama a esta ruta con "Authorization: Bearer <CRON_SECRET>".
// Sin CRON_SECRET configurada, se rechaza cualquier llamada (fail-closed).
async function GETHandler(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [resultado, avisosReprogramacion] = await Promise.all([
    procesarRecordatorios(),
    procesarAvisosReprogramacion(),
  ]);
  return NextResponse.json({ ...resultado, avisosReprogramacion });
}

export const GET = conErrores(GETHandler);
