import { z } from "zod";
import { fechaSchema, horaSchema, emailSchema } from "@/lib/validations/comun";

export const medicoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  matricula: z.string().trim().max(50).optional().or(z.literal("")),
  especialidadId: z.string().min(1, "Elegí una especialidad"),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  duracionTurnoMinutos: z.coerce.number().int().min(5).max(240),
  activo: z.boolean(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Elegí un color válido")
    .optional(),
});

export type MedicoInput = z.infer<typeof medicoSchema>;

export const horarioSchema = z.object({
  diaSemana: z.enum([
    "LUNES",
    "MARTES",
    "MIERCOLES",
    "JUEVES",
    "VIERNES",
    "SABADO",
    "DOMINGO",
  ]),
  horaInicio: horaSchema,
  horaFin: horaSchema,
  duracionTurno: z.coerce.number().int().min(5).max(240).nullable().optional(),
  vigenteDesde: fechaSchema.optional().or(z.literal("")),
  vigenteHasta: fechaSchema.optional().or(z.literal("")),
});

export type HorarioInput = z.infer<typeof horarioSchema>;
