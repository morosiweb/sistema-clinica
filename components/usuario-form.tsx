"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type UsuarioFormValues = {
  nombre: string;
  email: string;
  password: string;
  rol: "ADMIN" | "SECRETARIA" | "MEDICO";
  activo: boolean;
  medicoId: string;
};

const vacio: UsuarioFormValues = {
  nombre: "",
  email: "",
  password: "",
  rol: "SECRETARIA",
  activo: true,
  medicoId: "",
};

export function UsuarioForm({
  valoresIniciales,
  usuarioId,
  medicosDisponibles,
}: {
  valoresIniciales?: UsuarioFormValues;
  usuarioId?: string;
  medicosDisponibles: { id: string; nombre: string; apellido: string }[];
}) {
  const router = useRouter();
  const [valores, setValores] = useState<UsuarioFormValues>(valoresIniciales ?? vacio);
  const [error, setError] = useState<string | null>(null);
  const [credenciales, setCredenciales] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const url = usuarioId ? `/api/admin/usuarios/${usuarioId}` : "/api/admin/usuarios";
    const method = usuarioId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valores),
    });

    setGuardando(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo guardar.");
      return;
    }
    if (!usuarioId && body?.passwordTemporal) {
      setCredenciales(body.passwordTemporal);
      return;
    }
    router.push("/admin/usuarios");
    router.refresh();
  }

  if (credenciales) {
    return (
      <div className="space-y-4 rounded-md border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-sm">Usuario creado. Esta es su contraseña inicial, no se vuelve a mostrar:</p>
        <p className="rounded-md bg-neutral-100 px-3 py-2 font-mono text-sm dark:bg-neutral-800">
          {credenciales}
        </p>
        <button
          onClick={() => {
            router.push("/admin/usuarios");
            router.refresh();
          }}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Listo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Nombre *</label>
        <input
          required
          className={inputClass}
          value={valores.nombre}
          onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Email *</label>
        <input
          required
          type="email"
          className={inputClass}
          value={valores.email}
          onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Rol *</label>
        <select
          className={inputClass}
          value={valores.rol}
          onChange={(e) => setValores((v) => ({ ...v, rol: e.target.value as UsuarioFormValues["rol"] }))}
        >
          <option value="SECRETARIA">Secretaria</option>
          <option value="MEDICO">Médico</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {valores.rol === "MEDICO" && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Médico vinculado</label>
          <select
            className={inputClass}
            value={valores.medicoId}
            onChange={(e) => setValores((v) => ({ ...v, medicoId: e.target.value }))}
          >
            <option value="">— Sin vincular —</option>
            {medicosDisponibles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.apellido}, {m.nombre}
              </option>
            ))}
          </select>
          {medicosDisponibles.length === 0 && (
            <p className="text-xs text-neutral-500">
              No hay médicos sin usuario vinculado. Cargalo primero en Médicos.
            </p>
          )}
        </div>
      )}

      {usuarioId && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Nueva contraseña (opcional)</label>
          <input
            type="password"
            className={inputClass}
            placeholder="Dejar en blanco para no cambiarla"
            value={valores.password}
            onChange={(e) => setValores((v) => ({ ...v, password: e.target.value }))}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={valores.activo}
          onChange={(e) => setValores((v) => ({ ...v, activo: e.target.checked }))}
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
          onClick={() => router.push("/admin/usuarios")}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
