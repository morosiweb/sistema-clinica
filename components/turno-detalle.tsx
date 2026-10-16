"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Historial = { id: string; accion: string; realizadoPor: string; detalle: string | null; fecha: string };

export type TurnoDetalleData = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  motivoConsulta: string | null;
  notasSecretaria: string | null;
  notasMedico: string | null;
  version: number;
  paciente: { nombre: string; apellido: string; dni: string; telefono: string | null };
  medico: { nombre: string; apellido: string; especialidad: { nombre: string } };
  historial: Historial[];
};

const ESTADOS = ["PENDIENTE", "CONFIRMADO", "CANCELADO", "AUSENTE", "ATENDIDO"] as const;

export function TurnoDetalle({ turno, esMedico }: { turno: TurnoDetalleData; esMedico: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState(turno.estado);
  const [notasSecretaria, setNotasSecretaria] = useState(turno.notasSecretaria ?? "");
  const [notasMedico, setNotasMedico] = useState(turno.notasMedico ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  async function guardar() {
    setError(null);
    setGuardando(true);
    const res = await fetch(`/api/turnos/${turno.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, notasSecretaria, notasMedico, version: turno.version }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo guardar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <p className="font-medium">
          {turno.paciente.apellido}, {turno.paciente.nombre} · DNI {turno.paciente.dni}
        </p>
        {turno.paciente.telefono && <p className="text-neutral-500">{turno.paciente.telefono}</p>}
        <p className="mt-2 text-neutral-500">
          {turno.medico.apellido}, {turno.medico.nombre} · {turno.medico.especialidad.nombre}
        </p>
        <p className="text-neutral-500">
          {new Date(turno.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })} · {turno.horaInicio}–
          {turno.horaFin}
        </p>
        {turno.motivoConsulta && <p className="mt-2">Motivo: {turno.motivoConsulta}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Estado</label>
        <select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value)}>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      {!esMedico && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Notas de secretaría</label>
          <textarea
            className={inputClass}
            rows={3}
            value={notasSecretaria}
            onChange={(e) => setNotasSecretaria(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium">Notas clínicas (médico)</label>
        <textarea
          className={inputClass}
          rows={3}
          value={notasMedico}
          onChange={(e) => setNotasMedico(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={guardar}
        disabled={guardando}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Historial</h2>
        <div className="space-y-1 text-xs text-neutral-500">
          {turno.historial.map((h) => (
            <p key={h.id}>
              {new Date(h.fecha).toLocaleString("es-AR")} · {h.accion} · {h.realizadoPor}
              {h.detalle ? ` · ${h.detalle}` : ""}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
