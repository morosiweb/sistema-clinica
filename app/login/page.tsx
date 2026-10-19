"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ArrowRight, ShieldCheck, HeartPulse } from "lucide-react";
import { signIn } from "next-auth/react";
import { Volver } from "@/components/volver";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError(null);
      setCargando(true);
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email o contraseña incorrectos.");
        return;
      }
      router.push("/panel");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo conectar. Intentá nuevamente.",
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-back">
        <Volver destino="/" />
      </div>
      <section className="login-story">
        <Brand light />
        <div>
          <p className="eyebrow">ESPACIO DEL PERSONAL</p>
          <h2>
            Cuidar mejor.
            <br />
            <em>Trabajar en equipo.</em>
          </h2>
          <p>
            Un espacio para conectar la agenda, el consultorio y cada paso de la
            atención.
          </p>
          <div className="login-art" aria-hidden="true">
            <HeartPulse size={150} strokeWidth={0.8} />
          </div>
        </div>
        <span className="login-story-footer">
          Cerca de las personas. En cada detalle.
        </span>
      </section>
      <section className="login-form-area">
        <Link href="/" className="login-back">
          ← Volver a la clínica
        </Link>
        <div className="login-form-wrap">
          <span className="verification-icon">
            <ShieldCheck size={25} />
          </span>
          <p className="eyebrow">BIENVENIDO A TU ESPACIO</p>
          <h1>Qué bueno verte.</h1>
          <p className="muted">
            Ingresá con tus datos para comenzar la jornada.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label htmlFor="email" className="field-label">
              Email
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="nombre@clinica.com"
              />
            </label>
            <label htmlFor="password" className="field-label">
              Contraseña
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="Tu contraseña"
              />
            </label>
            {error && (
              <p role="alert" className="notice notice-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={cargando}
              className="btn btn-primary w-full"
            >
              {cargando ? "Ingresando..." : "Ingresar"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-note">
            <ShieldCheck size={15} />
            Acceso exclusivo para personal autorizado.
          </p>
        </div>
        <p className="login-bottom">
          ¿Necesitás acceso? Comunicate con administración.
        </p>
      </section>
    </main>
  );
}
