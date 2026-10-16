import { z } from "zod";
import { fechaValida } from "@/lib/fecha";

export const fechaSchema = z.string().refine(fechaValida, "Fecha inválida");
export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM");
export const dniSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[.\s-]/g, ""))
  .pipe(z.string().regex(/^\d{6,9}$/, "Ingresá un DNI de 6 a 9 dígitos"));
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido");
export const versionSchema = z.number().int().min(0);
export const rangoSchema = z
  .object({ desde: fechaSchema, hasta: fechaSchema })
  .refine((v) => v.desde <= v.hasta, "El rango de fechas es inválido");

export const paginaSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(10000)
  .default(1);
