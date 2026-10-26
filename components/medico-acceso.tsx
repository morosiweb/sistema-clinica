"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Cuenta = { email: string; activo: boolean; versionSesion: number };
type Credenciales = {
  usuario: Cuenta;
  passwordInicial: string;
  actualizada: boolean;
};

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
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cuentaCreada, setCuentaCreada] = useState<Cuenta | null>(null);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const cuentaActual = cuentaCreada ?? cuenta;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/medicos/${medicoId}/acceso`, {
        method: cuentaActual ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          cuentaActual
            ? {
                password,
                confirmacion,
                versionSesion: cuentaActual.versionSesion,
              }
            : { email, password },
        ),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "No se pudo guardar el acceso.");
        if (res.status === 409) router.refresh();
        return;
      }
      setCredenciales({
        usuario: body.usuario,
        passwordInicial: password,
        actualizada: !!cuentaActual,
      });
      setCuentaCreada(body.usuario);
      setPassword("");
      setConfirmacion("");
      setMostrarPassword(false);
      setCambiandoPassword(false);
    } catch {
      setError(
        "No se pudo confirmar el resultado. Recargá el perfil para comprobar el estado del acceso antes de intentar nuevamente.",
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
          <p className="text-sm font-medium">
            {credenciales.actualizada
              ? "Contraseña actualizada"
              : "Acceso creado"}{" "}
            para {nombre}.
          </p>
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
              <dt className="font-medium">
                {credenciales.actualizada
                  ? "Nueva contraseña"
                  : "Contraseña inicial"}
              </dt>
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
      ) : (
        <>
          {cuentaActual ? (
            <div className="space-y-2 text-sm">
              <p>Este médico ya tiene acceso al panel.</p>
              <p>
                Usuario:{" "}
                <strong className="break-all">{cuentaActual.email}</strong>
              </p>
              <p>Estado: {cuentaActual.activo ? "Activo" : "Inactivo"}</p>
              {!cuentaActual.activo && (
                <p className="text-neutral-500">
                  La cuenta seguirá inactiva después del cambio de contraseña.
                  Para reactivarla, comunicate con administración.
                </p>
              )}
              {!cambiandoPassword && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setCambiandoPassword(true);
                    setError(null);
                    setPassword("");
                    setConfirmacion("");
                  }}
                >
                  Cambiar contraseña
                </button>
              )}
            </div>
          ) : !activo ? (
            <p className="text-sm">
              Activá y guardá la ficha del médico para poder crear su acceso.
            </p>
          ) : null}
          {(cuentaActual ? cambiandoPassword : activo) && (
            <form onSubmit={guardar} className="space-y-4">
              {cuentaActual && (
                <p className="text-sm text-neutral-500">
                  Elegí y confirmá la nueva contraseña para entregarle al
                  médico. Se cerrarán sus sesiones abiertas.
                </p>
              )}
              {!cuentaActual && (
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
                  <p
                    id="medico-acceso-ayuda"
                    className="text-sm text-neutral-500"
                  >
                    Este email será su usuario.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <label
                  htmlFor="medico-acceso-password"
                  className="text-sm font-medium"
                >
                  {cuentaActual
                    ? "Nueva contraseña *"
                    : "Contraseña para el médico *"}
                </label>
                <input
                  id="medico-acceso-password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={guardando}
                  aria-describedby="medico-acceso-password-ayuda"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
                <p
                  id="medico-acceso-password-ayuda"
                  className="text-sm text-neutral-500"
                >
                  Elegí una contraseña de al menos 8 caracteres para entregarle
                  al médico.
                </p>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="medico-acceso-confirmacion"
                  className="text-sm font-medium"
                >
                  Confirmar contraseña *
                </label>
                <input
                  id="medico-acceso-confirmacion"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  disabled={guardando}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
              <button
                type="button"
                aria-pressed={mostrarPassword}
                onClick={() => setMostrarPassword((mostrar) => !mostrar)}
                className="text-sm underline"
              >
                {mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              </button>
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
                {guardando
                  ? "Guardando…"
                  : cuentaActual
                    ? "Guardar contraseña"
                    : "Crear acceso"}
              </button>
              {cuentaActual && (
                <button
                  type="button"
                  disabled={guardando}
                  className="btn btn-outline ml-2"
                  onClick={() => {
                    setCambiandoPassword(false);
                    setPassword("");
                    setConfirmacion("");
                    setMostrarPassword(false);
                    setError(null);
                  }}
                >
                  Cancelar
                </button>
              )}
            </form>
          )}
        </>
      )}
    </section>
  );
}
