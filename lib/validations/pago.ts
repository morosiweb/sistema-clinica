import { z } from "zod";

export const pagoSchema = z.object({
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "OTRO"]),
  notas: z.string().trim().max(300).optional().or(z.literal("")),
});

export type PagoInput = z.infer<typeof pagoSchema>;
