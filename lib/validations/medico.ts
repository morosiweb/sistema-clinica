import { z } from "zod";

export const medicoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  matricula: z.string().trim().max(50).optional().or(z.literal("")),
  especialidadId: z.string().min(1, "Elegí una especialidad"),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  duracionTurnoMinutos: z.coerce.number().int().min(5).max(240),
  activo: z.boolean(),
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
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM"),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM"),
});

export type HorarioInput = z.infer<typeof horarioSchema>;
