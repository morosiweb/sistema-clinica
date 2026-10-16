import { z } from "zod";
import { fechaSchema, horaSchema } from "@/lib/validations/comun";
export const bloqueoSchema = z
  .object({
    medicoId: z.string().min(1),
    fecha: fechaSchema,
    horaInicio: horaSchema.optional().or(z.literal("")),
    horaFin: horaSchema.optional().or(z.literal("")),
    motivo: z.string().trim().min(3).max(300),
  })
  .refine(
    (v) =>
      (!v.horaInicio && !v.horaFin) ||
      (!!v.horaInicio && !!v.horaFin && v.horaInicio < v.horaFin),
    "Indicá ambas horas en orden o dejá ambas vacías para todo el día",
  );
