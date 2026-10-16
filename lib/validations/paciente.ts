import { z } from "zod";

export const pacienteSchema = z.object({
  dni: z.string().trim().min(6, "DNI inválido").max(15),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  fechaNacimiento: z.string().optional().or(z.literal("")),
  obraSocial: z.string().trim().max(100).optional().or(z.literal("")),
});

export type PacienteInput = z.infer<typeof pacienteSchema>;
