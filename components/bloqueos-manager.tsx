"use client";
import { useState } from "react";
import { fetchJSON, mensajeError, useHoy, useRecurso } from "@/lib/cliente";
type Medico = { id: string; nombre: string; apellido: string };
type Bloqueo = {
  id: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  motivo: string;
  estado: string;
  medico: { nombre: string; apellido: string };
};
export function BloqueosManager({
  medicos,
  esMedico,
}: {
  medicos: Medico[];
  esMedico: boolean;
}) {
  const hoy = useHoy();
  const [medicoId, setMedico] = useState(medicos[0]?.id || "");
  const [dia, setDia] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const recurso = useRecurso<Bloqueo[]>("/api/bloqueos");
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      await fetchJSON("/api/bloqueos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicoId,
          fecha: dia || hoy,
          horaInicio: inicio,
          horaFin: fin,
          motivo,
        }),
      });
      setMotivo("");
      recurso.refrescar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  async function resolver(id: string, estado: string) {
    setOcupado(true);
    setError("");
    try {
      await fetchJSON(`/api/bloqueos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      recurso.refrescar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  const input = "mt-1 w-full rounded border p-2 dark:bg-neutral-900";
  return (
    <div className="space-y-6">
      <p className="text-sm">
        {esMedico
          ? "Tus solicitudes requieren aprobación de secretaría o administración."
          : "Las licencias aprobadas dejan de ofrecer horarios. Antes de aprobar, resolvé los turnos ya reservados."}
      </p>
      <form
        onSubmit={crear}
        className="grid gap-3 rounded border p-4 sm:grid-cols-2"
      >
        <label className="text-sm">
          Médico
          <select
            required
            className={input}
            value={medicoId}
            onChange={(e) => setMedico(e.target.value)}
          >
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.apellido}, {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Fecha
          <input
            required
            type="date"
            min={hoy}
            className={input}
            value={dia || hoy}
            onChange={(e) => setDia(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Desde (opcional)
          <input
            type="time"
            className={input}
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Hasta (opcional)
          <input
            type="time"
            className={input}
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </label>
        <p className="text-xs sm:col-span-2">
          Dejá ambas horas vacías para bloquear todo el día.
        </p>
        <label className="text-sm sm:col-span-2">
          Motivo
          <input
            required
            minLength={3}
            maxLength={300}
            className={input}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <button
          disabled={ocupado || !medicoId}
          className="rounded bg-neutral-900 p-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {esMedico ? "Solicitar licencia" : "Registrar licencia"}
        </button>
      </form>
      {(error || recurso.error) && (
        <p role="alert" className="text-sm text-red-600">
          {error || recurso.error}
        </p>
      )}
      {recurso.cargando && <p>Cargando solicitudes…</p>}
      {recurso.data?.map((b) => (
        <article key={b.id} className="space-y-2 rounded border p-3 text-sm">
          <p>
            {b.medico.apellido}, {b.medico.nombre} · {b.fecha.slice(0, 10)} ·{" "}
            {b.horaInicio ? `${b.horaInicio}–${b.horaFin}` : "Todo el día"}
          </p>
          <p>
            {b.motivo} · {b.estado}
          </p>
          {!esMedico && b.estado === "PENDIENTE" && (
            <div className="flex gap-4">
              <button
                disabled={ocupado}
                className="underline"
                onClick={() => resolver(b.id, "APROBADO")}
              >
                Aprobar
              </button>
              <button
                disabled={ocupado}
                className="underline"
                onClick={() => resolver(b.id, "RECHAZADO")}
              >
                Rechazar
              </button>
            </div>
          )}
        </article>
      ))}
      {recurso.data?.length === 0 && <p>No hay licencias registradas.</p>}
    </div>
  );
}
