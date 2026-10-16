"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Paciente = { id: string; nombre: string; apellido: string; dni: string };
type Medico = { id: string; nombre: string; apellido: string; especialidad: { nombre: string } };

export function TurnoForm({ medicos }: { medicos: Medico[] }) {
  const router = useRouter();
  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [resultados, setResultados] = useState<Paciente[]>([]);
  const [pacienteElegido, setPacienteElegido] = useState<Paciente | null>(null);

  const [medicoId, setMedicoId] = useState(medicos[0]?.id ?? "");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (busquedaPaciente.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/pacientes?q=${encodeURIComponent(busquedaPaciente)}`);
      if (res.ok) setResultados(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [busquedaPaciente]);

  useEffect(() => {
    if (!medicoId || !fecha) return;
    setHoraInicio("");
    fetch(`/api/disponibilidad?medicoId=${medicoId}&fecha=${fecha}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []));
  }, [medicoId, fecha]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pacienteElegido) {
      setError("Elegí un paciente.");
      return;
    }
    if (!horaInicio) {
      setError("Elegí un horario.");
      return;
    }
    setGuardando(true);
    const res = await fetch("/api/turnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pacienteId: pacienteElegido.id,
        medicoId,
        fecha,
        horaInicio,
        motivoConsulta,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo guardar.");
      return;
    }
    router.push("/turnos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Paciente *</label>
        {pacienteElegido ? (
          <div className="flex items-center justify-between rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
            <span>
              {pacienteElegido.apellido}, {pacienteElegido.nombre} · DNI {pacienteElegido.dni}
            </span>
            <button
              type="button"
              onClick={() => {
                setPacienteElegido(null);
                setBusquedaPaciente("");
              }}
              className="text-neutral-500 underline"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              className={inputClass}
              placeholder="Buscar por DNI, nombre o apellido..."
              value={busquedaPaciente}
              onChange={(e) => setBusquedaPaciente(e.target.value)}
            />
            {resultados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                {resultados.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setPacienteElegido(p);
                      setResultados([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    {p.apellido}, {p.nombre} · DNI {p.dni}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <a href="/pacientes/nuevo" className="text-xs text-neutral-500 underline">
          ¿No existe? Cargarlo como paciente nuevo
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Médico *</label>
          <select className={inputClass} value={medicoId} onChange={(e) => setMedicoId(e.target.value)}>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.apellido}, {m.nombre} · {m.especialidad.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Fecha *</label>
          <input
            type="date"
            className={inputClass}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Horario *</label>
        <select
          className={inputClass}
          value={horaInicio}
          onChange={(e) => setHoraInicio(e.target.value)}
        >
          <option value="">— Elegir —</option>
          {slots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {slots.length === 0 && (
          <p className="text-xs text-neutral-500">No hay horarios disponibles ese día.</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Motivo de consulta</label>
        <input
          className={inputClass}
          value={motivoConsulta}
          onChange={(e) => setMotivoConsulta(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {guardando ? "Guardando..." : "Reservar turno"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/turnos")}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
