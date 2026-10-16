"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJSON, mensajeError } from "@/lib/cliente";
const DIAS = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
] as const;
type Horario = {
  id: string;
  diaSemana: (typeof DIAS)[number];
  horaInicio: string;
  horaFin: string;
  duracionTurno?: number | null;
  vigenteDesde?: Date | null;
  vigenteHasta?: Date | null;
};
export function HorarioManager({
  medicoId,
  horarios,
}: {
  medicoId: string;
  horarios: Horario[];
}) {
  const router = useRouter();
  const [diaSemana, setDia] = useState<(typeof DIAS)[number]>("LUNES");
  const [horaInicio, setInicio] = useState("09:00");
  const [horaFin, setFin] = useState("13:00");
  const [duracion, setDuracion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOcupado(true);
    try {
      await fetchJSON(`/api/medicos/${medicoId}/horarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diaSemana,
          horaInicio,
          horaFin,
          duracionTurno: duracion ? Number(duracion) : null,
          vigenteDesde: desde,
          vigenteHasta: hasta,
        }),
      });
      router.refresh();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  async function eliminar(id: string) {
    if (
      !confirm(
        "¿Eliminar este bloque de disponibilidad? Los turnos existentes se conservan.",
      )
    )
      return;
    setError("");
    setOcupado(true);
    try {
      await fetchJSON(`/api/medicos/${medicoId}/horarios/${id}`, {
        method: "DELETE",
      });
      router.refresh();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  const input = "mt-1 w-full rounded border p-2 dark:bg-neutral-900";
  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Día
          <select
            className={input}
            value={diaSemana}
            onChange={(e) => setDia(e.target.value as typeof diaSemana)}
          >
            {DIAS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Duración en minutos (opcional)
          <input
            type="number"
            min={5}
            max={240}
            className={input}
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            placeholder="Usar duración del médico"
          />
        </label>
        <label className="text-sm">
          Desde
          <input
            required
            type="time"
            className={input}
            value={horaInicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Hasta
          <input
            required
            type="time"
            className={input}
            value={horaFin}
            onChange={(e) => setFin(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Vigente desde (opcional)
          <input
            type="date"
            className={input}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Vigente hasta (opcional)
          <input
            type="date"
            className={input}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
        <button
          disabled={ocupado}
          className="rounded bg-neutral-900 p-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Agregar bloque
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {DIAS.map((d) => (
        <div key={d} className="space-y-2 text-sm">
          <p className="font-medium">{d}</p>
          {horarios
            .filter((h) => h.diaSemana === d)
            .map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 rounded border p-2"
              >
                <span>
                  {h.horaInicio}–{h.horaFin}
                  {h.duracionTurno ? ` · ${h.duracionTurno} min` : ""}
                  {h.vigenteDesde
                    ? ` · desde ${new Date(h.vigenteDesde).toISOString().slice(0, 10)}`
                    : ""}
                  {h.vigenteHasta
                    ? ` · hasta ${new Date(h.vigenteHasta).toISOString().slice(0, 10)}`
                    : ""}
                </span>
                <button
                  disabled={ocupado}
                  aria-label={`Eliminar ${d} ${h.horaInicio}`}
                  className="text-red-600 underline"
                  onClick={() => eliminar(h.id)}
                >
                  Eliminar
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
