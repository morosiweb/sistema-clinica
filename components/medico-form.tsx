"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type MedicoFormValues = {
  nombre: string;
  apellido: string;
  matricula: string;
  especialidadId: string;
  telefono: string;
  email: string;
  duracionTurnoMinutos: number;
  activo: boolean;
};

export function MedicoForm({
  especialidades,
  valoresIniciales,
  medicoId,
}: {
  especialidades: { id: string; nombre: string }[];
  valoresIniciales?: MedicoFormValues;
  medicoId?: string;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<MedicoFormValues>(
    valoresIniciales ?? {
      nombre: "",
      apellido: "",
      matricula: "",
      especialidadId: especialidades[0]?.id ?? "",
      telefono: "",
      email: "",
      duracionTurnoMinutos: 30,
      activo: true,
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  async function handleSubmit(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError(null);
      setGuardando(true);

      const url = medicoId ? `/api/medicos/${medicoId}` : "/api/medicos";
      const method = medicoId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
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
      if (medicoId) {
        router.refresh();
      } else {
        router.push("/medicos");
        router.refresh();
      }
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="medico-form-campo-1" className="text-sm font-medium">
            Nombre *
          </label>
          <input
            id="medico-form-campo-1"
            required
            className={inputClass}
            value={valores.nombre}
            onChange={(e) =>
              setValores((v) => ({ ...v, nombre: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="medico-form-campo-2" className="text-sm font-medium">
            Apellido *
          </label>
          <input
            id="medico-form-campo-2"
            required
            className={inputClass}
            value={valores.apellido}
            onChange={(e) =>
              setValores((v) => ({ ...v, apellido: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="medico-form-campo-3" className="text-sm font-medium">
            Especialidad *
          </label>
          <select
            id="medico-form-campo-3"
            className={inputClass}
            value={valores.especialidadId}
            onChange={(e) =>
              setValores((v) => ({ ...v, especialidadId: e.target.value }))
            }
          >
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="medico-form-campo-4" className="text-sm font-medium">
            Matrícula
          </label>
          <input
            id="medico-form-campo-4"
            className={inputClass}
            value={valores.matricula}
            onChange={(e) =>
              setValores((v) => ({ ...v, matricula: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="medico-form-campo-5" className="text-sm font-medium">
            Teléfono
          </label>
          <input
            id="medico-form-campo-5"
            className={inputClass}
            value={valores.telefono}
            onChange={(e) =>
              setValores((v) => ({ ...v, telefono: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="medico-form-campo-6" className="text-sm font-medium">
            Email
          </label>
          <input
            id="medico-form-campo-6"
            type="email"
            className={inputClass}
            value={valores.email}
            onChange={(e) =>
              setValores((v) => ({ ...v, email: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="medico-form-campo-7" className="text-sm font-medium">
          Duración del turno (minutos) *
        </label>
        <input
          id="medico-form-campo-7"
          type="number"
          min={5}
          max={240}
          required
          className={inputClass}
          value={valores.duracionTurnoMinutos}
          onChange={(e) =>
            setValores((v) => ({
              ...v,
              duracionTurnoMinutos: Number(e.target.value),
            }))
          }
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={valores.activo}
          onChange={(e) =>
            setValores((v) => ({ ...v, activo: e.target.checked }))
          }
        />
        Activo
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/medicos")}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          Volver
        </button>
      </div>
    </form>
  );
}
