import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { conErrores } from "@/lib/errores";
import { cambioClaveSchema } from "@/lib/validations/cuenta";
import { cambiarClave } from "@/lib/cuenta";
import { limitarSolicitud } from "@/lib/verificacion";
export const POST = conErrores(async (request: NextRequest) => {
  const { session, response } = await requireSession();
  if (!session) return response;
  await limitarSolicitud(`clave:${session.user.id}`, 5);
  const { actual, nueva } = cambioClaveSchema.parse(await request.json());
  await cambiarClave(
    session.user.id,
    session.user.versionSesion ?? 0,
    actual,
    nueva,
  );
  return NextResponse.json({ ok: true });
});
