"use client";

import { useState } from "react";
import Link from "next/link";
import { useHoy, useRecurso } from "@/lib/cliente";
import { useRouter } from "next/navigation";

type Paciente = { id: string; nombre: string; apellido: string; dni: string };
type Medico = {
  id: string;
  nombre: string;
  apellido: string;
  especialidad: { nombre: string };
};

export function TurnoForm({
  medicos,
  prefill,
}: {
  medicos: Medico[];
  prefill?: { medicoId?: string; fecha?: string; hora?: string };
}) {
  const router = useRouter();
  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const hoy = useHoy();
  const pacientes = useRecurso<Paciente[]>(
    busquedaPaciente.trim().length >= 2
      ? `/api/pacientes?q=${encodeURIComponent(busquedaPaciente)}`
      : null,
  );
  const resultados = pacientes.data || [];
  const [pacienteElegido, setPacienteElegido] = useState<Paciente | null>(null);

  const [medicoId, setMedicoId] = useState(
    prefill?.medicoId || medicos[0]?.id || "",
  );
  const [dia, setFecha] = useState(prefill?.fecha || "");
  const fecha = dia || hoy;
  const [horaInicio, setHoraInicio] = useState(prefill?.hora || "");
  const disponibilidad = useRecurso<{ slots: string[] }>(
    medicoId && fecha
      ? `/api/disponibilidad?${new URLSearchParams({ medicoId, fecha })}`
      : null,
  );
  const slots = disponibilidad.data?.slots || [];
  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError(null);
      if (!pacienteElegido) {
        setError("Elegí un paciente.");
        return;
      }
      if (
        !horaInicio ||
        !slots.includes(horaInicio) ||
        disponibilidad.cargando
      ) {
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

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error && typeof body.error === "string"
            ? body.error
            : "No se pudo guardar.",
        );
        return;
      }
      router.push("/turnos");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo conectar. Intentá nuevamente.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="turno-buscar-paciente" className="text-sm font-medium">
          Paciente *
        </label>
        {pacienteElegido ? (
          <div className="flex items-center justify-between rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
            <span>
              {pacienteElegido.apellido}, {pacienteElegido.nombre} · DNI{" "}
              {pacienteElegido.dni}
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
              id="turno-buscar-paciente"
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
                      setBusquedaPaciente("");
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
        <Link
          href="/pacientes/nuevo"
          className="text-xs text-neutral-500 underline"
        >
          ¿No existe? Cargarlo como paciente nuevo
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="turno-form-campo-1" className="text-sm font-medium">
            Médico *
          </label>
          <select
            id="turno-form-campo-1"
            className={inputClass}
            value={medicoId}
            onChange={(e) => {
              setMedicoId(e.target.value);
              setHoraInicio("");
            }}
          >
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.apellido}, {m.nombre} · {m.especialidad.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="turno-form-campo-2" className="text-sm font-medium">
            Fecha *
          </label>
          <input
            id="turno-form-campo-2"
            type="date"
            className={inputClass}
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              setHoraInicio("");
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="turno-form-campo-3" className="text-sm font-medium">
          Horario *
        </label>
        <select
          id="turno-form-campo-3"
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
          <p className="text-xs text-neutral-500">
            No hay horarios disponibles ese día.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="turno-form-campo-4" className="text-sm font-medium">
          Motivo de consulta
        </label>
        <input
          id="turno-form-campo-4"
          className={inputClass}
          value={motivoConsulta}
          onChange={(e) => setMotivoConsulta(e.target.value)}
        />
      </div>

      {(disponibilidad.error || pacientes.error) && (
        <p role="alert" className="text-sm text-red-600">
          {disponibilidad.error || pacientes.error}
        </p>
      )}
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
