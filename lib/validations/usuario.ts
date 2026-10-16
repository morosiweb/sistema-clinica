import { z } from "zod";

export const usuarioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres").optional().or(z.literal("")),
  rol: z.enum(["ADMIN", "SECRETARIA", "MEDICO"]),
  activo: z.boolean(),
});

export type UsuarioInput = z.infer<typeof usuarioSchema>;
