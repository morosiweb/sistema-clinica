const LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  AUSENTE: "Ausente",
  ATENDIDO: "Atendido",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`status-badge status-${estado.toLowerCase()}`}>
      {LABELS[estado] ?? estado}
    </span>
  );
}
