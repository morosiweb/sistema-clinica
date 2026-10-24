import { z } from "zod";
import { emailSchema } from "@/lib/validations/comun";
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "Usá una contraseña de hasta 72 caracteres")
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "La contraseña es demasiado larga; usá menos caracteres",
  );
export const cambioClaveSchema = z
  .object({
    actual: z.string().min(1).max(200),
    nueva: passwordSchema,
    confirmacion: z.string(),
  })
  .refine((v) => v.nueva === v.confirmacion, "Las contraseñas no coinciden");
export const recuperarCuentaSchema = z.object({ email: emailSchema.max(254) });
export const restablecerCuentaSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    nueva: passwordSchema,
    confirmacion: z.string(),
  })
  .refine((v) => v.nueva === v.confirmacion, "Las contraseñas no coinciden");
