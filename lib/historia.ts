import { prisma } from "@/lib/prisma";
import type { RolInterno } from "@/app/generated/prisma/client";
import type { EntradaHistoria } from "@/components/historia-clinica";

// Quién puede ver el CONTENIDO de las notas clínicas de una consulta:
// - ADMIN: todo.
// - MEDICO: solo las propias (las de otro médico quedan ocultas, como pide el plan).
// - SECRETARIA: ninguna (solo sabe que existen, vía hayNotas).
export async function obtenerHistoriaPaciente(
  pacienteId: string,
  viewer: { rol: RolInterno; medicoId: string | null },
  opciones?: { excluirTurnoId?: string; pagina?: number },
): Promise<EntradaHistoria[]> {
  const turnos = await prisma.turno.findMany({
    where: {
      pacienteId,
      ...(opciones?.excluirTurnoId
        ? { NOT: { id: opciones.excluirTurnoId } }
        : {}),
    },
    include: { medico: { include: { especialidad: true } } },
    orderBy: [{ fecha: "desc" }, { horaInicio: "desc" }, { id: "desc" }],
    take: 50,
    skip: ((opciones?.pagina || 1) - 1) * 50,
  });

  return turnos.map((t) => {
    const puedeVerNotas =
      viewer.rol === "ADMIN" ||
      (viewer.rol === "MEDICO" && t.medicoId === viewer.medicoId);
    return {
      id: t.id,
      fecha: t.fecha.toISOString(),
      horaInicio: t.horaInicio,
      estado: t.estado,
      requiereReprogramacion: t.requiereReprogramacion,
      motivoConsulta: t.motivoConsulta,
      medico: {
        nombre: t.medico.nombre,
        apellido: t.medico.apellido,
        especialidad: t.medico.especialidad.nombre,
      },
      hayNotas: !!t.notasMedico,
      notasMedico: puedeVerNotas ? t.notasMedico : null,
    };
  });
}
