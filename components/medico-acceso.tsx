"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Cuenta = { email: string; activo: boolean };
type Credenciales = { usuario: Cuenta; passwordInicial: string };

export function MedicoAcceso({
  medicoId,
  nombre,
  emailMedico,
  activo,
  cuenta,
}: {
  medicoId: string;
  nombre: string;
  emailMedico: string;
  activo: boolean;
  cuenta: Cuenta | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(emailMedico);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cuentaCreada, setCuentaCreada] = useState<Cuenta | null>(null);
  const cuentaActual = cuentaCreada ?? cuenta;

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/medicos/${medicoId}/acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "No se pudo crear el acceso.");
        if (res.status === 409) router.refresh();
        return;
      }
      setCredenciales(body);
      setCuentaCreada(body.usuario);
    } catch {
      setError(
        "No se pudo confirmar la creación. Recargá el perfil para comprobar si el acceso se creó antes de intentar nuevamente.",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function copiar() {
    if (!credenciales) return;
    try {
      await navigator.clipboard.writeText(
        `Acceso al panel de ${nombre}\n${window.location.origin}/login\nUsuario: ${credenciales.usuario.email}\nContraseña: ${credenciales.passwordInicial}`,
      );
      setAviso("Datos copiados para entregar al médico.");
    } catch {
      setAviso(
        "No se pudieron copiar. Podés seleccionar los datos y copiarlos manualmente.",
      );
    }
  }

  return (
    <section
      className="mt-10 space-y-4 rounded-md border border-neutral-200 p-6 dark:border-neutral-800"
      aria-labelledby="acceso-medico-titulo"
    >
      <div>
        <h2 id="acceso-medico-titulo" className="text-lg font-semibold">
          Acceso al panel
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          El médico ingresa con su email y contraseña para consultar su agenda y
          atender a sus pacientes.
        </p>
      </div>

      {credenciales ? (
        <div className="space-y-4" role="status">
          <p className="text-sm font-medium">Acceso creado para {nombre}.</p>
          <p className="text-sm">
            Copiá los datos para entregárselos. La contraseña se muestra
            únicamente ahora.
          </p>
          <dl className="space-y-2 rounded-md bg-neutral-100 p-4 text-sm dark:bg-neutral-800">
            <div>
              <dt className="font-medium">Ingreso</dt>
              <dd>/login</dd>
            </div>
            <div>
              <dt className="font-medium">Usuario (email)</dt>
              <dd className="break-all select-all">
                {credenciales.usuario.email}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Contraseña inicial</dt>
              <dd className="break-all font-mono select-all">
                {credenciales.passwordInicial}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className="btn btn-primary">
              Copiar datos de acceso
            </button>
            <button
              type="button"
              onClick={() => {
                setCredenciales(null);
                setAviso(null);
                router.refresh();
              }}
              className="btn btn-outline"
            >
              Listo
            </button>
          </div>
          {aviso && (
            <p className="text-sm" role="status">
              {aviso}
            </p>
          )}
        </div>
      ) : cuentaActual ? (
        <div className="space-y-2 text-sm">
          <p>Este médico ya tiene acceso al panel.</p>
          <p>
            Usuario: <strong className="break-all">{cuentaActual.email}</strong>
          </p>
          <p>Estado: {cuentaActual.activo ? "Activo" : "Inactivo"}</p>
          <p className="text-neutral-500">
            Si necesita una nueva contraseña o reactivar su cuenta, debe
            solicitarlo al administrador.
          </p>
        </div>
      ) : !activo ? (
        <p className="text-sm">
          Activá y guardá la ficha del médico para poder crear su acceso.
        </p>
      ) : (
        <form onSubmit={generar} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="medico-acceso-email"
              className="text-sm font-medium"
            >
              Email para ingresar *
            </label>
            <input
              id="medico-acceso-email"
              type="email"
              autoComplete="off"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={guardando}
              aria-describedby="medico-acceso-ayuda"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <p id="medico-acceso-ayuda" className="text-sm text-neutral-500">
              Este email será su usuario. Se generará una contraseña
              automáticamente.
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="btn btn-primary"
          >
            {guardando ? "Generando acceso…" : "Generar usuario y contraseña"}
          </button>
        </form>
      )}
    </section>
  );
}
