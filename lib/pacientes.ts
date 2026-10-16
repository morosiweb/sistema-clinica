import { prisma } from "@/lib/prisma";
import { generarToken, hashToken, encriptarToken } from "@/lib/token";

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
  createdAt: true,
  updatedAt: true,
} as const;

export function crearTokenAcceso() {
  const token = generarToken();
  return {
    token,
    tokenAccesoHash: hashToken(token),
    tokenAccesoEnc: encriptarToken(token),
  };
}

// Un médico solo puede editar la ficha médica / registrar visitas de
// pacientes a los que efectivamente atendió (tiene al menos un turno con
// ellos). ADMIN no tiene esta restricción.
export async function medicoAtendioAlPaciente(
  medicoId: string,
  pacienteId: string,
): Promise<boolean> {
  const turno = await prisma.turno.findFirst({
    where: { medicoId, pacienteId, estado: { not: "CANCELADO" } },
    select: { id: true },
  });
  return !!turno;
}
