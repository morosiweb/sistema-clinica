"use client";

import { useState } from "react";

export default function RecuperarAccesoPage() {
  const [dni, setDni] = useState("");
  const [contacto, setContacto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    await fetch("/api/publico/recuperar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni, contacto }),
    });
    setEnviando(false);
    // Siempre se muestra el mismo mensaje, haya o no coincidencia.
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="mb-4 text-xl font-semibold">Listo</h1>
        <p className="text-sm text-neutral-500">
          Si los datos coinciden con un registro, te enviamos el link a tu email.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-2 text-xl font-semibold">Recuperar mi acceso</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Ingresá tu DNI y el teléfono o email con el que reservaste.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">DNI</label>
          <input required className={inputClass} value={dni} onChange={(e) => setDni(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Teléfono o email</label>
          <input
            required
            className={inputClass}
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {enviando ? "Enviando..." : "Recuperar acceso"}
        </button>
      </form>
    </div>
  );
}
