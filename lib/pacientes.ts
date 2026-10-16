import { prisma } from "@/lib/prisma";
import { generarToken, hashToken, encriptarToken, desencriptarToken } from "@/lib/token";

// Para devolver un Paciente al cliente sin tokenAccesoHash/tokenAccesoEnc
// (su link de acceso). Usar siempre que un paciente completo vaya en una
// respuesta JSON; las pantallas que necesitan la ficha médica la piden aparte.
export const pacienteSelectSeguro = {
  id: true,
  dni: true,
  nombre: true,
  apellido: true,
  telefono: true,
  email: true,
  fechaNacimiento: true,
  obraSocial: true,
  pesoKg: true,
  alturaCm: true,
  grupoSanguineo: true,
  alergias: true,
  antecedentes: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function crearTokenAcceso() {
  const token = generarToken();
  return { token, tokenAccesoHash: hashToken(token), tokenAccesoEnc: encriptarToken(token) };
}

type DatosPaciente = {
  nombre: string;
  apellido: string;
  telefono?: string | null;
  email?: string | null;
  fechaNacimiento?: Date | null;
  obraSocial?: string | null;
};

// Identificación por DNI sin duplicar identidades: si ya existe un paciente
// con ese DNI se reutiliza (y su mismo token, desencriptado), nunca se crea
// un segundo registro ni un segundo token para la misma persona.
export async function obtenerOCrearPaciente(dni: string, datos: DatosPaciente) {
  const existente = await prisma.paciente.findUnique({ where: { dni } });
  if (existente) {
    return { paciente: existente, token: desencriptarToken(existente.tokenAccesoEnc), esNuevo: false };
  }

  const { token, tokenAccesoHash, tokenAccesoEnc } = crearTokenAcceso();
  const paciente = await prisma.paciente.create({
    data: {
      dni,
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono || null,
      email: datos.email || null,
      fechaNacimiento: datos.fechaNacimiento || null,
      obraSocial: datos.obraSocial || null,
      tokenAccesoHash,
      tokenAccesoEnc,
    },
  });
  return { paciente, token, esNuevo: true };
}

// Un médico solo puede editar la ficha médica / registrar visitas de
// pacientes a los que efectivamente atendió (tiene al menos un turno con
// ellos). ADMIN no tiene esta restricción.
export async function medicoAtendioAlPaciente(medicoId: string, pacienteId: string): Promise<boolean> {
  const turno = await prisma.turno.findFirst({ where: { medicoId, pacienteId }, select: { id: true } });
  return !!turno;
}
