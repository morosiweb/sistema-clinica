"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FichaMedicaData = {
  pesoKg: number | null;
  alturaCm: number | null;
  grupoSanguineo: string | null;
  alergias: string | null;
  antecedentes: string | null;
};

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

export function FichaMedica({ pacienteId, inicial }: { pacienteId: string; inicial: FichaMedicaData }) {
  const router = useRouter();
  const [pesoKg, setPesoKg] = useState(inicial.pesoKg?.toString() ?? "");
  const [alturaCm, setAlturaCm] = useState(inicial.alturaCm?.toString() ?? "");
  const [grupoSanguineo, setGrupoSanguineo] = useState(inicial.grupoSanguineo ?? "");
  const [alergias, setAlergias] = useState(inicial.alergias ?? "");
  const [antecedentes, setAntecedentes] = useState(inicial.antecedentes ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarVisita, setMostrarVisita] = useState(false);
  const [fechaVisita, setFechaVisita] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaVisita, setHoraVisita] = useState("");
  const [motivoVisita, setMotivoVisita] = useState("");
  const [notasVisita, setNotasVisita] = useState("");
  const [guardandoVisita, setGuardandoVisita] = useState(false);
  const [errorVisita, setErrorVisita] = useState<string | null>(null);

  async function guardarFicha() {
    setError(null);
    setGuardando(true);
    const res = await fetch(`/api/pacientes/${pacienteId}/ficha-medica`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pesoKg, alturaCm, grupoSanguineo, alergias, antecedentes }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo guardar.");
      return;
    }
    router.refresh();
  }

  async function registrarVisita(e: React.FormEvent) {
    e.preventDefault();
    if (!horaVisita) {
      setErrorVisita("Elegí un horario.");
      return;
    }
    setErrorVisita(null);
    setGuardandoVisita(true);
    const res = await fetch(`/api/pacientes/${pacienteId}/visitas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: fechaVisita,
        horaInicio: horaVisita,
        motivoConsulta: motivoVisita,
        notasMedico: notasVisita,
      }),
    });
    setGuardandoVisita(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setErrorVisita(body?.error && typeof body.error === "string" ? body.error : "No se pudo registrar.");
      return;
    }
    setMostrarVisita(false);
    setHoraVisita("");
    setMotivoVisita("");
    setNotasVisita("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">Ficha médica</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Peso (kg)</label>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Altura (cm)</label>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={alturaCm}
              onChange={(e) => setAlturaCm(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <label className="text-xs text-neutral-500">Grupo sanguíneo</label>
          <input className={inputClass} value={grupoSanguineo} onChange={(e) => setGrupoSanguineo(e.target.value)} />
        </div>
        <div className="mt-3 space-y-1">
          <label className="text-xs text-neutral-500">Alergias</label>
          <textarea
            className={inputClass}
            rows={2}
            value={alergias}
            onChange={(e) => setAlergias(e.target.value)}
          />
        </div>
        <div className="mt-3 space-y-1">
          <label className="text-xs text-neutral-500">Antecedentes</label>
          <textarea
            className={inputClass}
            rows={2}
            value={antecedentes}
            onChange={(e) => setAntecedentes(e.target.value)}
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={guardarFicha}
          disabled={guardando}
          className="mt-3 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {guardando ? "Guardando..." : "Guardar ficha médica"}
        </button>
      </div>

      <div>
        {!mostrarVisita ? (
          <button onClick={() => setMostrarVisita(true)} className="text-sm underline">
            + Registrar otra visita con este paciente
          </button>
        ) : (
          <form onSubmit={registrarVisita} className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Nueva visita</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-500">Fecha</label>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaVisita}
                  onChange={(e) => setFechaVisita(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-500">Hora</label>
                <input
                  type="time"
                  className={inputClass}
                  value={horaVisita}
                  onChange={(e) => setHoraVisita(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-neutral-500">Motivo</label>
              <input className={inputClass} value={motivoVisita} onChange={(e) => setMotivoVisita(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-neutral-500">Notas clínicas</label>
              <textarea
                className={inputClass}
                rows={2}
                value={notasVisita}
                onChange={(e) => setNotasVisita(e.target.value)}
              />
            </div>
            {errorVisita && <p className="text-sm text-red-600">{errorVisita}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={guardandoVisita}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {guardandoVisita ? "Guardando..." : "Registrar visita"}
              </button>
              <button
                type="button"
                onClick={() => setMostrarVisita(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
