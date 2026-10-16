"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"] as const;
const DIA_LABEL: Record<(typeof DIAS)[number], string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

type Horario = { id: string; diaSemana: (typeof DIAS)[number]; horaInicio: string; horaFin: string };

export function HorarioManager({ medicoId, horarios }: { medicoId: string; horarios: Horario[] }) {
  const router = useRouter();
  const [diaSemana, setDiaSemana] = useState<(typeof DIAS)[number]>("LUNES");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("13:00");
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/medicos/${medicoId}/horarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diaSemana, horaInicio, horaFin }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo agregar.");
      return;
    }
    router.refresh();
  }

  async function eliminar(horarioId: string) {
    await fetch(`/api/medicos/${medicoId}/horarios/${horarioId}`, { method: "DELETE" });
    router.refresh();
  }

  const porDia = DIAS.map((dia) => ({
    dia,
    bloques: horarios.filter((h) => h.diaSemana === dia),
  }));

  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Día</label>
          <select
            className={inputClass}
            value={diaSemana}
            onChange={(e) => setDiaSemana(e.target.value as (typeof DIAS)[number])}
          >
            {DIAS.map((d) => (
              <option key={d} value={d}>
                {DIA_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Desde</label>
          <input
            type="time"
            className={inputClass}
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Hasta</label>
          <input
            type="time"
            className={inputClass}
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Agregar bloque
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {porDia.map(({ dia, bloques }) => (
          <div key={dia} className="flex items-start gap-3 text-sm">
            <span className="w-24 shrink-0 text-neutral-500">{DIA_LABEL[dia]}</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {bloques.length === 0 && <span className="text-neutral-400">—</span>}
              {bloques.map((b) => (
                <span
                  key={b.id}
                  className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 dark:border-neutral-800"
                >
                  {b.horaInicio}–{b.horaFin}
                  <button onClick={() => eliminar(b.id)} className="text-neutral-400 hover:text-red-600">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
