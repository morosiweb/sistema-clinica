export const ESTADOS_TURNO = [
  "PENDIENTE",
  "CONFIRMADO",
  "LLEGO",
  "EN_ESPERA",
  "EN_CONSULTA",
  "CANCELADO",
  "AUSENTE",
  "ATENDIDO",
] as const;
export const ESTADOS_RESERVADOS = [
  "PENDIENTE",
  "CONFIRMADO",
  "LLEGO",
  "EN_ESPERA",
  "EN_CONSULTA",
] as const;
export const ETIQUETAS_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  LLEGO: "Llegó",
  EN_ESPERA: "En sala de espera",
  EN_CONSULTA: "En consulta",
  CANCELADO: "Cancelado",
  AUSENTE: "Ausente",
  ATENDIDO: "Atendido",
};
export const MAX_NOTA_CLINICA = 20000;
