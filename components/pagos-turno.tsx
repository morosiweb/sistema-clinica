"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Pago = {
  id: string;
  monto: string;
  metodo: string;
  notas: string | null;
  registradoPor: string;
  fecha: string;
};

const METODOS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "OTRO"] as const;

export function PagosTurno({ turnoId, pagos }: { turnoId: string; pagos: Pago[] }) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<(typeof METODOS)[number]>("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const inputClass =
    "rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  const total = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const res = await fetch(`/api/turnos/${turnoId}/pagos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto, metodo }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "No se pudo registrar el pago.");
      return;
    }
    setMonto("");
    router.refresh();
  }

  async function eliminar(pagoId: string) {
    if (!confirm("¿Eliminar este pago?")) return;
    await fetch(`/api/turnos/${turnoId}/pagos/${pagoId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cobros</h2>
        <span className="text-sm font-medium">Total: ${total.toFixed(2)}</span>
      </div>

      {pagos.length > 0 && (
        <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
          {pagos.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2">
              <span>
                ${Number(p.monto).toFixed(2)} · {p.metodo} ·{" "}
                {new Date(p.fecha).toLocaleDateString("es-AR")}
              </span>
              <button onClick={() => eliminar(p.id)} className="text-red-600 underline">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={agregar} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Monto</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            className={inputClass}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Método</label>
          <select
            className={inputClass}
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as (typeof METODOS)[number])}
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Registrar cobro
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
