"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Especialidad = { id: string; nombre: string; descripcion: string | null };

export function EspecialidadManager({ especialidades }: { especialidades: Especialidad[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch("/api/especialidades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, descripcion }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo guardar.");
      return;
    }
    setNombre("");
    setDescripcion("");
    router.refresh();
  }

  async function guardarEdicion(id: string, nuevoNombre: string, nuevaDescripcion: string) {
    setError(null);
    const res = await fetch(`/api/especialidades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre, descripcion: nuevaDescripcion }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo guardar.");
      return;
    }
    setEditandoId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={crear} className="flex gap-2">
        <input
          required
          placeholder="Nombre (ej: Cardiología)"
          className={inputClass}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          placeholder="Descripción (opcional)"
          className={inputClass}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <button
          type="submit"
          disabled={guardando}
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Agregar
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {especialidades.map((esp) =>
          editandoId === esp.id ? (
            <FilaEdicion
              key={esp.id}
              especialidad={esp}
              onCancelar={() => setEditandoId(null)}
              onGuardar={guardarEdicion}
            />
          ) : (
            <div key={esp.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p>{esp.nombre}</p>
                {esp.descripcion && <p className="text-neutral-500">{esp.descripcion}</p>}
              </div>
              <button onClick={() => setEditandoId(esp.id)} className="text-neutral-500 underline">
                Editar
              </button>
            </div>
          )
        )}
        {especialidades.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">No hay especialidades cargadas.</p>
        )}
      </div>
    </div>
  );
}

function FilaEdicion({
  especialidad,
  onCancelar,
  onGuardar,
}: {
  especialidad: Especialidad;
  onCancelar: () => void;
  onGuardar: (id: string, nombre: string, descripcion: string) => void;
}) {
  const [nombre, setNombre] = useState(especialidad.nombre);
  const [descripcion, setDescripcion] = useState(especialidad.descripcion ?? "");
  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <input
        className={inputClass}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Descripción"
      />
      <button
        onClick={() => onGuardar(especialidad.id, nombre, descripcion)}
        className="shrink-0 text-sm font-medium"
      >
        Guardar
      </button>
      <button onClick={onCancelar} className="shrink-0 text-sm text-neutral-500">
        Cancelar
      </button>
    </div>
  );
}
