import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

export type Transaccion = Prisma.TransactionClient;

// Todas las escrituras de agenda (incluidas licencias y horarios) comparten
// este bloqueo de PostgreSQL. Se libera al confirmar o revertir la transacción.
// ReadCommitted permite que las consultas posteriores vean la reserva que
// confirmó la transacción anterior mientras esperábamos el bloqueo.
export function transaccionAgenda<T>(
  operacion: (tx: Transaccion) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(847219, 1)`;
      return operacion(tx);
    },
    { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 15000 },
  );
}
