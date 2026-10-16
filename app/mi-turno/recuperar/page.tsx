"use client";
import Link from "next/link";
import { Mail, CalendarDays, ShieldCheck, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJSON, mensajeError } from "@/lib/cliente";
export default function RecuperarAccesoPage() {
  const router = useRouter();
  const [dni, setDni] = useState("");
  const [codigo, setCodigo] = useState("");
  const [id, setId] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      if (!id) {
        const data = await fetchJSON<{
          verificacionId: string;
          mensaje: string;
        }>("/api/publico/recuperar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dni }),
        });
        setId(data.verificacionId);
        setMensaje(data.mensaje);
      } else {
        const data = await fetchJSON<{ linkAcceso: string }>(
          "/api/publico/verificar",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ verificacionId: id, codigo }),
          },
        );
        router.push(data.linkAcceso);
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <main className="recovery-page">
      <section className="recovery-story">
        <p className="eyebrow">TU ATENCIÓN, MÁS CERCA</p>
        <h1>
          Gestionar mis turnos<span className="greeting-dot">.</span>
        </h1>
        <p>
          Consultá tus próximas visitas y organizá tu atención, estés donde
          estés. Sin cuentas ni contraseñas.
        </p>
        <div className="recovery-points">
          <div>
            <CalendarDays size={22} />
            <span>
              <strong>Tu agenda de salud</strong>
              <p>Consultá tus reservas y las opciones para modificarlas.</p>
            </span>
          </div>
          <div>
            <ShieldCheck size={22} />
            <span>
              <strong>Un acceso personal y seguro</strong>
              <p>Solo necesitás tu DNI y el código enviado por email.</p>
            </span>
          </div>
        </div>
        <Link href="/reservar" className="text-link mt-7">
          ¿Buscás una nueva consulta? Reservá un turno <ArrowRight size={16} />
        </Link>
      </section>
      <section className="recovery-card">
        <span className="verification-icon">
          <Mail size={25} />
        </span>
        <h2>{id ? "Revisá tu email" : "Accedé a tus turnos"}</h2>
        <p>
          {id
            ? "Ingresá el código de seis dígitos para continuar."
            : "Ingresá tu DNI para recibir un código en el email registrado en la clínica."}
        </p>
        <form onSubmit={enviar} className="space-y-4">
          <label className="field-label">
            {id ? "Código recibido por email" : "DNI"}
            <input
              className={id ? "field-input otp-input" : "field-input"}
              required
              inputMode="numeric"
              autoComplete={id ? "one-time-code" : "off"}
              pattern={id ? "[0-9]{6}" : undefined}
              maxLength={id ? 6 : 15}
              value={id ? codigo : dni}
              onChange={(e) =>
                id ? setCodigo(e.target.value) : setDni(e.target.value)
              }
            />
          </label>
          {mensaje && <p className="text-sm">{mensaje}</p>}
          {error && (
            <p role="alert" className="notice notice-error">
              {error}
            </p>
          )}
          <button disabled={enviando} className="btn btn-primary w-full">
            {enviando
              ? "Procesando…"
              : id
                ? "Ver mis turnos"
                : "Recibir código"}
          </button>
          {id && (
            <button
              type="button"
              disabled={enviando}
              className="text-link"
              onClick={() => {
                setId("");
                setCodigo("");
                setError("");
                setMensaje("");
              }}
            >
              Solicitar otro código
            </button>
          )}
        </form>
        <p className="help-text">
          El código vence en 10 minutos. Si tu contacto cambió o no recibís el
          correo, comunicate con secretaría.
        </p>
      </section>
    </main>
  );
}
