import type { Transaccion } from "@/lib/transaccion";
import { ErrorClinica } from "@/lib/errores";
import { fechaDB, fechaClinica } from "@/lib/fecha";
export async function validarBloqueo(
  tx: Transaccion,
  b: {
    medicoId: string;
    fecha: string;
    horaInicio?: string | null;
    horaFin?: string | null;
  },
) {
  if (b.fecha < fechaClinica())
    throw new ErrorClinica(
      "La licencia no puede aprobarse para una fecha pasada",
    );
  const turno = await tx.turno.findFirst({
    where: {
      medicoId: b.medicoId,
      fecha: fechaDB(b.fecha),
      estado: { in: ["PENDIENTE", "CONFIRMADO"] },
      horaInicio: { lt: b.horaFin || "24:00" },
      horaFin: { gt: b.horaInicio || "00:00" },
    },
    select: { id: true },
  });
  if (turno)
    throw new ErrorClinica(
      "Hay turnos en esa franja. Reprogramalos o cancelalos antes de aprobar la licencia.",
      409,
    );
}
