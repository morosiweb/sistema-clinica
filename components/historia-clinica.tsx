"use client";
import { useState } from "react";
import { fetchJSON, mensajeError } from "@/lib/cliente";
import { EstadoBadge } from "@/components/estado-badge";

export type EntradaHistoria = {
  id: string;
  fecha: string;
  horaInicio: string;
  estado: string;
  motivoConsulta: string | null;
  medico: { nombre: string; apellido: string; especialidad: string };
  hayNotas: boolean;
  // null = sin notas, o notas que el viewer no tiene permiso de ver.
  notasMedico: string | null;
};

export function HistoriaClinica({
  entradas,
  pacienteId,
  excluirTurnoId,
}: {
  entradas: EntradaHistoria[];
  pacienteId?: string;
  excluirTurnoId?: string;
}) {
  const [otras, setOtras] = useState<EntradaHistoria[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(entradas.length === 50);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  async function cargarMas() {
    if (!pacienteId) return;
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams({
        pagina: String(pagina + 1),
        ...(excluirTurnoId ? { excluirTurnoId } : {}),
      });
      const datos = await fetchJSON<EntradaHistoria[]>(
        `/api/pacientes/${pacienteId}/historia?${params}`,
      );
      setOtras((v) => [...v, ...datos]);
      setPagina((v) => v + 1);
      setHayMas(datos.length === 50);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  if (entradas.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Todavía no tiene consultas registradas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {[...entradas, ...otras].map((e) => (
        <div
          key={e.id}
          className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {new Date(e.fecha).toLocaleDateString("es-AR", {
                timeZone: "UTC",
              })}{" "}
              · {e.horaInicio}
            </span>
            <EstadoBadge estado={e.estado} />
          </div>
          <p className="text-neutral-500">
            {e.medico.apellido}, {e.medico.nombre} · {e.medico.especialidad}
          </p>
          {e.motivoConsulta && (
            <p className="mt-1">Motivo: {e.motivoConsulta}</p>
          )}
          {e.notasMedico && (
            <p className="mt-2 rounded bg-neutral-50 p-2 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {e.notasMedico}
            </p>
          )}
          {!e.notasMedico && e.hayNotas && (
            <p className="mt-2 text-xs italic text-neutral-400">
              🔒 Tiene notas clínicas cargadas, no visibles para tu rol.
            </p>
          )}
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      {pacienteId && hayMas && (
        <button
          disabled={cargando}
          onClick={cargarMas}
          className="text-sm underline"
        >
          {cargando ? "Cargando…" : "Ver consultas anteriores"}
        </button>
      )}
    </div>
  );
}
