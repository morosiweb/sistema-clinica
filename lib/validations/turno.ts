import { z } from "zod";

export const crearTurnoSchema = z.object({
  pacienteId: z.string().min(1, "Elegí un paciente"),
  medicoId: z.string().min(1, "Elegí un médico"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM"),
  motivoConsulta: z.string().trim().max(300).optional().or(z.literal("")),
});

export const actualizarTurnoSchema = z.object({
  estado: z.enum(["PENDIENTE", "CONFIRMADO", "CANCELADO", "AUSENTE", "ATENDIDO"]),
  notasSecretaria: z.string().trim().max(1000).optional().or(z.literal("")),
  notasMedico: z.string().trim().max(1000).optional().or(z.literal("")),
  version: z.number().int(),
});

export type CrearTurnoInput = z.infer<typeof crearTurnoSchema>;
export type ActualizarTurnoInput = z.infer<typeof actualizarTurnoSchema>;
