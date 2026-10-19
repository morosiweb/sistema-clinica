import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { comprobarAccesoPaciente } from "@/lib/documentacion-paciente";
import { conErrores, ErrorClinica } from "@/lib/errores";
async function GETHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; archivoId: string }> },
) {
  const { session, response } = await requireSession(["pacientes", "agenda"]);
  if (!session) return response;
  const { id, archivoId } = await params;
  await comprobarAccesoPaciente(id, session.user);
  const archivo = await prisma.archivoPaciente.findFirst({
    where: { id: archivoId, pacienteId: id },
  });
  if (!archivo) throw new ErrorClinica("Archivo no encontrado", 404);
  const nombre = encodeURIComponent(archivo.nombre).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16)}`,
  );
  return new Response(new Uint8Array(archivo.contenido), {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Disposition": `attachment; filename="archivo"; filename*=UTF-8''${nombre}`,
      "Content-Length": String(archivo.tamanio),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
export const GET = conErrores(GETHandler);
