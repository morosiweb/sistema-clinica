"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PacienteFormValues = {
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  obraSocial: string;
};

const vacio: PacienteFormValues = {
  dni: "",
  nombre: "",
  apellido: "",
  telefono: "",
  email: "",
  fechaNacimiento: "",
  obraSocial: "",
};

export function PacienteForm({
  valoresIniciales,
  pacienteId,
}: {
  valoresIniciales?: PacienteFormValues;
  pacienteId?: string;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<PacienteFormValues>(
    valoresIniciales ?? vacio,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function campo<K extends keyof PacienteFormValues>(key: K) {
    return {
      value: valores[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setValores((v) => ({ ...v, [key]: e.target.value })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError(null);
      setGuardando(true);

      const url = pacienteId
        ? `/api/pacientes/${pacienteId}`
        : "/api/pacientes";
      const method = pacienteId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error && typeof data.error === "string"
            ? data.error
            : "No se pudo guardar.",
        );
        return;
      }
      router.push("/pacientes");
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

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="paciente-form-campo-1"
            className="text-sm font-medium"
          >
            DNI *
          </label>
          <input
            id="paciente-form-campo-1"
            required
            className={inputClass}
            {...campo("dni")}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="paciente-form-campo-2"
            className="text-sm font-medium"
          >
            Obra social
          </label>
          <input
            id="paciente-form-campo-2"
            className={inputClass}
            {...campo("obraSocial")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="paciente-form-campo-3"
            className="text-sm font-medium"
          >
            Nombre *
          </label>
          <input
            id="paciente-form-campo-3"
            required
            className={inputClass}
            {...campo("nombre")}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="paciente-form-campo-4"
            className="text-sm font-medium"
          >
            Apellido *
          </label>
          <input
            id="paciente-form-campo-4"
            required
            className={inputClass}
            {...campo("apellido")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="paciente-form-campo-5"
            className="text-sm font-medium"
          >
            Teléfono
          </label>
          <input
            id="paciente-form-campo-5"
            className={inputClass}
            {...campo("telefono")}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="paciente-form-campo-6"
            className="text-sm font-medium"
          >
            Email
          </label>
          <input
            id="paciente-form-campo-6"
            type="email"
            className={inputClass}
            {...campo("email")}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="paciente-form-campo-7" className="text-sm font-medium">
          Fecha de nacimiento
        </label>
        <input
          id="paciente-form-campo-7"
          type="date"
          className={inputClass}
          {...campo("fechaNacimiento")}
        />
      </div>

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
          onClick={() => router.push("/pacientes")}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
