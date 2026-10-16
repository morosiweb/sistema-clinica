import { z } from "zod";
import { fechaSchema, dniSchema, emailSchema } from "@/lib/validations/comun";

export const pacienteSchema = z.object({
  dni: dniSchema,
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  fechaNacimiento: fechaSchema.optional().or(z.literal("")),
  obraSocial: z.string().trim().max(100).optional().or(z.literal("")),
});

export type PacienteInput = z.infer<typeof pacienteSchema>;
