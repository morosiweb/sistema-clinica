const ESTILOS: Record<string, string> = {
  PENDIENTE:
    "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  CONFIRMADO: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CANCELADO: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  AUSENTE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ATENDIDO: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  AUSENTE: "Ausente",
  ATENDIDO: "Atendido",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILOS[estado] ?? ""}`}
    >
      {LABELS[estado] ?? estado}
    </span>
  );
}
