import { z } from "zod";
import {
  fechaSchema,
  horaSchema,
  versionSchema,
} from "@/lib/validations/comun";

const numeroOpcional = z
  .union([z.coerce.number().positive(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const fichaMedicaSchema = z.object({
  versionFicha: versionSchema,
  pesoKg: numeroOpcional,
  alturaCm: numeroOpcional,
  grupoSanguineo: z.string().trim().max(10).optional().or(z.literal("")),
  alergias: z.string().trim().max(500).optional().or(z.literal("")),
  antecedentes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const nuevaVisitaSchema = z.object({
  fecha: fechaSchema,
  horaInicio: horaSchema,
  motivoConsulta: z.string().trim().max(300).optional().or(z.literal("")),
  notasMedico: z.string().trim().max(1000).optional().or(z.literal("")),
});
