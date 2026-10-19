import { prisma } from "@/lib/prisma";
import { ErrorClinica } from "@/lib/errores";
import type { RolInterno } from "@/app/generated/prisma/client";

export const MAX_ARCHIVO = 3 * 1024 * 1024;
export const archivoSelect = {
  id: true,
  nombre: true,
  tipo: true,
  tamanio: true,
  createdAt: true,
  autor: { select: { nombre: true } },
} as const;
export const notaPacienteSelect = {
  id: true,
  contenido: true,
  createdAt: true,
  autor: { select: { nombre: true } },
} as const;

export async function comprobarAccesoPaciente(
  pacienteId: string,
  viewer: { rol: RolInterno; medicoId: string | null },
) {
  // La misma comprobación se usa para listar, agregar y descargar.
  if (viewer.rol === "MEDICO") {
    const relacion =
      viewer.medicoId &&
      (await prisma.turno.findFirst({
        where: {
          pacienteId,
          medicoId: viewer.medicoId,
          estado: { not: "CANCELADO" },
          medico: { activo: true },
        },
        select: { id: true },
      }));
    if (!relacion) throw new ErrorClinica("Sin acceso a este paciente", 403);
  }
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { id: true },
  });
  if (!paciente) throw new ErrorClinica("Paciente no encontrado", 404);
}

export function validarArchivo(nombre: string, datos: Buffer) {
  const extension = nombre.split(".").at(-1)?.toLowerCase();
  const tipos: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    txt: "text/plain",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  if (!extension || !tipos[extension])
    throw new ErrorClinica(
      "Usá PDF, imágenes PNG/JPG/WebP, Word, Excel o texto",
    );
  if (!datos.length || datos.length > MAX_ARCHIVO)
    throw new ErrorClinica("Cada archivo debe tener entre 1 byte y 3 MB", 413);
  const valido =
    extension === "pdf"
      ? datos.subarray(0, 5).toString() === "%PDF-"
      : extension === "png"
        ? datos
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : extension === "jpg" || extension === "jpeg"
          ? datos[0] === 255 && datos[1] === 216 && datos[2] === 255
          : extension === "webp"
            ? datos.subarray(0, 4).toString() === "RIFF" &&
              datos.subarray(8, 12).toString() === "WEBP"
            : extension === "docx" || extension === "xlsx"
              ? datos.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
              : !datos.includes(0);
  if (!valido)
    throw new ErrorClinica(
      "El contenido del archivo no coincide con su formato",
    );
  return tipos[extension];
}
