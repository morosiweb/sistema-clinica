import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { conErrores } from "@/lib/errores";
import { diagnosticarCorreo } from "@/lib/notificaciones";
import { limitarSolicitud } from "@/lib/verificacion";

async function GETHandler() {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  await limitarSolicitud(`diagnostico-correo:${session.user.id}`, 6);
  return NextResponse.json(await diagnosticarCorreo());
}

export const GET = conErrores(GETHandler);
