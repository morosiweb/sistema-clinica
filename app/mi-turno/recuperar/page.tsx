"use client";
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
    <main className="mx-auto max-w-md space-y-4 px-6 py-16">
      <h1 className="text-xl font-semibold">Gestionar mis turnos</h1>
      <p className="text-sm">
        No necesitás registrarte. Te enviamos un código al email que tiene la
        clínica.
      </p>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block text-sm">
          {id ? "Código recibido por email" : "DNI"}
          <input
            className="mt-1 w-full rounded border p-2 dark:bg-neutral-900"
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
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          disabled={enviando}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {enviando ? "Procesando…" : id ? "Ver mis turnos" : "Recibir código"}
        </button>
        {id && (
          <button
            type="button"
            disabled={enviando}
            className="ml-3 text-sm underline"
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
      <p className="text-sm text-neutral-500">
        El código vence en 10 minutos. Si tu contacto cambió o no recibís el
        correo, comunicate con secretaría.
      </p>
    </main>
  );
}
