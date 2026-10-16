import { z } from "zod";

export const reservaPublicaSchema = z.object({
  medicoId: z.string().min(1, "Elegí un médico"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM"),
  dni: z.string().trim().min(6, "DNI inválido").max(15),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  telefono: z.string().trim().min(6, "Teléfono inválido").max(30),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  motivoConsulta: z.string().trim().max(300).optional().or(z.literal("")),
});

export const recuperarAccesoSchema = z.object({
  dni: z.string().trim().min(6).max(15),
  contacto: z.string().trim().min(3).max(100),
});
