import { z } from "zod";
import { pacienteSchema } from "@/lib/validations/paciente";
import {
  fechaSchema,
  horaSchema,
  versionSchema,
} from "@/lib/validations/comun";

export const crearTurnoSchema = z
  .object({
    pacienteId: z.string().min(1).optional(),
    pacienteNuevo: pacienteSchema.optional(),
    medicoId: z.string().min(1, "Elegí un médico"),
    fecha: fechaSchema,
    horaInicio: horaSchema,
    motivoConsulta: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .refine(
    (v) => !!v.pacienteId !== !!v.pacienteNuevo,
    "Elegí un paciente existente o completá los datos de uno nuevo",
  );

export const actualizarTurnoSchema = z.object({
  estado: z.enum([
    "PENDIENTE",
    "CONFIRMADO",
    "CANCELADO",
    "AUSENTE",
    "ATENDIDO",
  ]),
  notasSecretaria: z.string().trim().max(1000).optional().or(z.literal("")),
  notasMedico: z.string().trim().max(1000).optional().or(z.literal("")),
  version: versionSchema,
});

export type CrearTurnoInput = z.infer<typeof crearTurnoSchema>;
export type ActualizarTurnoInput = z.infer<typeof actualizarTurnoSchema>;
