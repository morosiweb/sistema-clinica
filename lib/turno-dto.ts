import type { RolInterno } from "@/app/generated/prisma/client";

export function turnoParaInterno<
  T extends { medicoId: string; notasMedico: string | null },
>(turno: T, viewer: { rol: RolInterno; medicoId: string | null }) {
  const permitido =
    viewer.rol === "ADMIN" ||
    (viewer.rol === "MEDICO" && viewer.medicoId === turno.medicoId);
  return { ...turno, notasMedico: permitido ? turno.notasMedico : null };
}

// Un enlace de gestión no da acceso a notas clínicas ni de secretaría.
export const turnoPublicoSelect = {
  id: true,
  medicoId: true,
  fecha: true,
  horaInicio: true,
  horaFin: true,
  estado: true,
  motivoConsulta: true,
  version: true,
  medico: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      especialidad: { select: { id: true, nombre: true } },
    },
  },
} as const;
