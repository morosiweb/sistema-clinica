import { z } from "zod";
import { fechaSchema, horaSchema } from "@/lib/validations/comun";
export const bloqueoSchema = z
  .object({
    medicoId: z.string().min(1),
    fecha: fechaSchema,
    fechaHasta: fechaSchema.optional(),
    horaInicio: horaSchema.optional().or(z.literal("")),
    horaFin: horaSchema.optional().or(z.literal("")),
    motivo: z.string().trim().min(3).max(300),
    confirmarReprogramacion: z.boolean().optional(),
    turnosConfirmados: z
      .array(
        z.object({
          id: z.string().min(1),
          version: z.number().int().nonnegative(),
        }),
      )
      .max(5000)
      .optional(),
  })
  .refine(
    (v) =>
      (!v.horaInicio && !v.horaFin) ||
      (!!v.horaInicio && !!v.horaFin && v.horaInicio < v.horaFin),
    "Indicá ambas horas en orden o dejá ambas vacías para todo el día",
  )
  .refine(
    (v) => !v.fechaHasta || v.fechaHasta >= v.fecha,
    "La fecha final debe ser igual o posterior a la inicial",
  )
  .refine(
    (v) =>
      !v.fechaHasta ||
      (Date.parse(v.fechaHasta) - Date.parse(v.fecha)) / 86400000 <= 365,
    "Elegí un período de hasta un año",
  );
export type BloqueoInput = z.infer<typeof bloqueoSchema>;
