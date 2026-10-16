"use client";

import { useEffect, useState } from "react";

type Medico = { id: string; nombre: string; apellido: string; especialidad: { nombre: string } };

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

export function ReprogramarForm({
  medicoActualId,
  onConfirmar,
  onCancelar,
}: {
  medicoActualId: string;
  onConfirmar: (medicoId: string, fecha: string, horaInicio: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicoId, setMedicoId] = useState(medicoActualId);
  const [hoy, setHoy] = useState("");
  const [fecha, setFecha] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date().toISOString().slice(0, 10);
    setHoy(d);
    setFecha(d);
    fetch("/api/publico/medicos")
      .then((r) => r.json())
      .then(setMedicos);
  }, []);

  useEffect(() => {
    if (!medicoId || !fecha) return;
    setHoraInicio("");
    fetch(`/api/publico/disponibilidad?medicoId=${medicoId}&fecha=${fecha}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []));
  }, [medicoId, fecha]);

  async function confirmar() {
    if (!horaInicio) {
      setError("Elegí un horario.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await onConfirmar(medicoId, fecha, horaInicio);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Médico</label>
          <select className={inputClass} value={medicoId} onChange={(e) => setMedicoId(e.target.value)}>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.apellido}, {m.nombre} · {m.especialidad.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Fecha</label>
          <input
            type="date"
            className={inputClass}
            value={fecha}
            min={hoy}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Horario</label>
        {slots.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay horarios disponibles ese día.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((s) => (
              <button
                key={s}
                onClick={() => setHoraInicio(s)}
                className={`rounded-md border px-2 py-1.5 text-xs ${
                  s === horaInicio
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={confirmar}
          disabled={enviando || !horaInicio}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {enviando ? "Guardando..." : "Confirmar cambio"}
        </button>
        <button onClick={onCancelar} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">
          Cancelar
        </button>
      </div>
    </div>
  );
}
