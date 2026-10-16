import { z } from "zod";

export const especialidadSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  descripcion: z.string().trim().max(300).optional().or(z.literal("")),
});

export type EspecialidadInput = z.infer<typeof especialidadSchema>;
