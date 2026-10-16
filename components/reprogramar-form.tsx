"use client";
import { useState } from "react";
import { mensajeError, useHoy, useRecurso } from "@/lib/cliente";
type Medico = {
  id: string;
  nombre: string;
  apellido: string;
  especialidad: { nombre: string };
};
export function ReprogramarForm({
  medicoActualId,
  onConfirmar,
  onCancelar,
}: {
  medicoActualId: string;
  onConfirmar: (
    medicoId: string,
    fecha: string,
    horaInicio: string,
  ) => Promise<void>;
  onCancelar: () => void;
}) {
  const hoy = useHoy();
  const [medicoId, setMedicoId] = useState(medicoActualId);
  const [dia, setDia] = useState("");
  const fecha = dia || hoy;
  const [hora, setHora] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const medicos = useRecurso<Medico[]>("/api/publico/medicos");
  const slots = useRecurso<{ slots: string[] }>(
    fecha && medicoId
      ? `/api/publico/disponibilidad?${new URLSearchParams({ medicoId, fecha })}`
      : null,
  );
  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await onConfirmar(medicoId, fecha, hora);
    } catch (e) {
      setError(mensajeError(e));
      slots.refrescar();
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form
      onSubmit={confirmar}
      className="reprogram-form space-y-4 rounded border p-5"
    >
      <label className="field-label">
        Médico
        <select
          className="field-input"
          value={medicoId}
          onChange={(e) => {
            setMedicoId(e.target.value);
            setHora("");
          }}
        >
          {medicos.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.apellido}, {m.nombre} · {m.especialidad.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Fecha
        <input
          type="date"
          min={hoy}
          required
          value={fecha}
          onChange={(e) => {
            setDia(e.target.value);
            setHora("");
          }}
          className="field-input"
        />
      </label>
      {slots.cargando ? (
        <p>Cargando horarios…</p>
      ) : (
        <label className="field-label">
          Horario
          <select
            required
            value={hora}
            className="field-input"
            onChange={(e) => setHora(e.target.value)}
          >
            <option value="">Elegir</option>
            {slots.data?.slots.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      {(error || slots.error || medicos.error) && (
        <p role="alert" className="text-sm text-red-600">
          {error || slots.error || medicos.error}
        </p>
      )}
      {slots.data?.slots.length === 0 && <p>No hay horarios disponibles.</p>}
      <button
        disabled={
          enviando ||
          !hora ||
          slots.cargando ||
          !slots.data?.slots.includes(hora)
        }
        className="btn btn-primary btn-small"
      >
        {enviando ? "Guardando…" : "Confirmar cambio"}
      </button>
      <button
        type="button"
        className="ml-3 text-sm underline"
        onClick={onCancelar}
      >
        Volver
      </button>
    </form>
  );
}
