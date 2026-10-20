const LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  AUSENTE: "Ausente",
  ATENDIDO: "Atendido",
};

export function EstadoBadge({
  estado,
  requiereReprogramacion,
}: {
  estado: string;
  requiereReprogramacion?: boolean;
}) {
  return (
    <span
      className={`status-badge status-${requiereReprogramacion ? "pendiente" : estado.toLowerCase()}`}
    >
      {requiereReprogramacion ? "Por reprogramar" : (LABELS[estado] ?? estado)}
    </span>
  );
}
