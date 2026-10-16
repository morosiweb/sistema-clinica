import { z } from "zod";

const numeroOpcional = z
  .union([z.coerce.number().positive(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const fichaMedicaSchema = z.object({
  pesoKg: numeroOpcional,
  alturaCm: numeroOpcional,
  grupoSanguineo: z.string().trim().max(10).optional().or(z.literal("")),
  alergias: z.string().trim().max(500).optional().or(z.literal("")),
  antecedentes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const nuevaVisitaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM"),
  motivoConsulta: z.string().trim().max(300).optional().or(z.literal("")),
  notasMedico: z.string().trim().max(1000).optional().or(z.literal("")),
});
