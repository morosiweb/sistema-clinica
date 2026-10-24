import { ETIQUETAS_ESTADO as LABELS } from "@/lib/estados-turno";

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
