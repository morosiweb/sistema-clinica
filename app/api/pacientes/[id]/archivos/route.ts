import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { conErrores, ErrorClinica } from "@/lib/errores";
import {
  comprobarAccesoPaciente,
  archivoSelect,
  MAX_ARCHIVO,
  validarArchivo,
} from "@/lib/documentacion-paciente";
import { paginaSchema } from "@/lib/validations/comun";
type Contexto = { params: Promise<{ id: string }> };
async function GETHandler(request: NextRequest, { params }: Contexto) {
  const { session, response } = await requireSession(["pacientes", "agenda"]);
  if (!session) return response;
  const { id } = await params;
  await comprobarAccesoPaciente(id, session.user);
  const pagina = paginaSchema.parse(
    request.nextUrl.searchParams.get("pagina") ?? undefined,
  );
  return NextResponse.json(
    await prisma.archivoPaciente.findMany({
      where: { pacienteId: id },
      select: archivoSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * 25,
      take: 25,
    }),
  );
}
async function POSTHandler(request: NextRequest, { params }: Contexto) {
  const { session, response } = await requireSession(["pacientes", "agenda"]);
  if (!session) return response;
  const { id } = await params;
  await comprobarAccesoPaciente(id, session.user);
  if (Number(request.headers.get("content-length")) > MAX_ARCHIVO + 16384)
    throw new ErrorClinica("El archivo supera el máximo de 3 MB", 413);
  const form = await request.formData();
  const archivo = form.get("archivo");
  if (!(archivo instanceof File))
    throw new ErrorClinica("Seleccioná un archivo");
  if (!archivo.size || archivo.size > MAX_ARCHIVO)
    throw new ErrorClinica("El archivo debe tener entre 1 byte y 3 MB", 413);
  const nombre = archivo.name
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  if (!nombre || nombre.length > 180)
    throw new ErrorClinica("Usá un nombre de archivo de hasta 180 caracteres");
  const contenido = Buffer.from(await archivo.arrayBuffer());
  const tipo = validarArchivo(nombre, contenido);
  return NextResponse.json(
    await prisma.archivoPaciente.create({
      data: {
        pacienteId: id,
        autorId: session.user.id,
        nombre,
        tipo,
        tamanio: contenido.length,
        contenido,
      },
      select: archivoSelect,
    }),
    { status: 201 },
  );
}
export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
