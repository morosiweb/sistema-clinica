import { passwordSchema } from "@/lib/validations/cuenta";
import { PANTALLAS } from "@/lib/pantallas";
import { z } from "zod";
import { emailSchema } from "@/lib/validations/comun";

export const usuarioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  email: emailSchema,
  password: passwordSchema.optional().or(z.literal("")),
  rol: z.enum(["ADMIN", "SECRETARIA", "MEDICO"]),
  activo: z.boolean(),
  permisos: z
    .array(
      z
        .string()
        .refine(
          (key) => PANTALLAS.some((p) => p.key === key),
          "Permiso desconocido",
        ),
    )
    .optional(),
  medicoId: z.string().optional().or(z.literal("")),
});

export type UsuarioInput = z.infer<typeof usuarioSchema>;
