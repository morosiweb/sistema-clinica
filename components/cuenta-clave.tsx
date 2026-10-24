"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { fetchJSON, mensajeError } from "@/lib/cliente";
import { useCambiosSinGuardar } from "@/lib/cambios-sin-guardar";

function CamposClave({
  nueva,
  confirmacion,
  setNueva,
  setConfirmacion,
}: {
  nueva: string;
  confirmacion: string;
  setNueva: (v: string) => void;
  setConfirmacion: (v: string) => void;
}) {
  return (
    <>
      <label className="field-label">
        Nueva contraseña
        <input
          className="field-input"
          required
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
      </label>
      <label className="field-label">
        Confirmar contraseña
        <input
          className="field-input"
          required
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
        />
      </label>
      <p className="text-sm">
        Usá al menos 8 caracteres. Al guardar, se cerrarán las sesiones abiertas
        de tu cuenta.
      </p>
    </>
  );
}
export function CambiarClaveForm({
  nombre,
  email,
}: {
  nombre: string;
  email: string;
}) {
  const [actual, setActual] = useState(""),
    [nueva, setNueva] = useState(""),
    [confirmacion, setConfirmacion] = useState(""),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const limpiar = useCambiosSinGuardar(!!actual || !!nueva || !!confirmacion);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      await fetchJSON("/api/cuenta/clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva, confirmacion }),
      });
      limpiar();
      await signOut({ redirectTo: "/login?clave=actualizada" });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="surface p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{nombre}</h2>
        <p>{email}</p>
      </div>
      <form onSubmit={guardar} className="space-y-4">
        <label className="field-label">
          Contraseña actual
          <input
            required
            className="field-input"
            type="password"
            autoComplete="current-password"
            maxLength={200}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </label>
        <CamposClave {...{ nueva, confirmacion, setNueva, setConfirmacion }} />
        {error && (
          <p role="alert" className="notice notice-error">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={ocupado}>
          {ocupado ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </section>
  );
}
export function RecuperarCuentaForm() {
  const [email, setEmail] = useState(""),
    [mensaje, setMensaje] = useState(""),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      const data = await fetchJSON<{ mensaje: string }>(
        "/api/cuenta/recuperar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      setMensaje(data.mensaje);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <main className="account-public surface space-y-5">
      <h1 className="text-xl font-semibold">Recuperar acceso del personal</h1>
      <p>Ingresá el email que usás para entrar al panel.</p>
      <form className="space-y-4" onSubmit={enviar}>
        <label className="field-label">
          Email
          <input
            className="field-input"
            required
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={ocupado}>
          {ocupado ? "Procesando…" : "Enviar enlace de recuperación"}
        </button>
      </form>
      {mensaje && (
        <p className="notice" role="status">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <Link href="/login" className="text-link">
        Volver al acceso del personal
      </Link>
    </main>
  );
}
export function RestablecerCuentaForm() {
  const token = useSearchParams().get("token") ?? "";
  const [nueva, setNueva] = useState(""),
    [confirmacion, setConfirmacion] = useState(""),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      await fetchJSON("/api/cuenta/restablecer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nueva, confirmacion }),
      });
      await signOut({ redirectTo: "/login?clave=actualizada" });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <main className="account-public surface space-y-5">
      <h1 className="text-xl font-semibold">Elegir nueva contraseña</h1>
      {token ? (
        <form className="space-y-4" onSubmit={guardar}>
          <CamposClave
            {...{ nueva, confirmacion, setNueva, setConfirmacion }}
          />
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={ocupado}>
            {ocupado ? "Guardando…" : "Guardar nueva contraseña"}
          </button>
        </form>
      ) : (
        <p>Falta el enlace de recuperación.</p>
      )}
      <Link href="/login/recuperar" className="text-link">
        Solicitar otro enlace
      </Link>
    </main>
  );
}
