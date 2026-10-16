import { z } from "zod";
import {
  fechaSchema,
  horaSchema,
  dniSchema,
  emailSchema,
  versionSchema,
} from "@/lib/validations/comun";

export const reservaPublicaSchema = z.object({
  verificacionId: z.string().min(20).max(100),
  codigo: z.string().regex(/^\d{6}$/, "Ingresá el código de seis dígitos"),
  medicoId: z.string().min(1, "Elegí un médico"),
  fecha: fechaSchema,
  horaInicio: horaSchema,
  dni: dniSchema,
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  telefono: z.string().trim().min(6, "Teléfono inválido").max(30),
  email: emailSchema,
  motivoConsulta: z.string().trim().max(300).optional().or(z.literal("")),
});

export const reprogramarTurnoSchema = z.object({
  turnoId: z.string().min(1),
  version: versionSchema,
  medicoId: z.string().min(1, "Elegí un médico"),
  fecha: fechaSchema,
  horaInicio: horaSchema,
});

export const recuperarAccesoSchema = z.object({ dni: dniSchema });
export const solicitarCodigoSchema = z.object({
  dni: dniSchema,
  email: emailSchema,
});
export const verificarAccesoSchema = z.object({
  verificacionId: z.string().min(20).max(100),
  codigo: z.string().regex(/^\d{6}$/, "Código inválido"),
});
