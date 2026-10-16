"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Reporte = {
  total: number;
  porMetodo: Record<string, number>;
  cantidadPagos: number;
  turnosSinCobrar: {
    id: string;
    fecha: string;
    horaInicio: string;
    paciente: string;
    medico: string;
  }[];
};

const inputClass =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

export function ReportesClient() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hoy = new Date();
    const primerDia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    setDesde(primerDia.toISOString().slice(0, 10));
    setHasta(hoy.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (!desde || !hasta) return;
    setCargando(true);
    setError(null);
    fetch(`/api/reportes/caja?desde=${desde}&hasta=${hasta}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d?.error ?? "No se pudo cargar el reporte.");
          setReporte(null);
          return;
        }
        setReporte(d);
      })
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Reportes</h1>

      <div className="mb-6 flex items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Desde</label>
          <input type="date" className={inputClass} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Hasta</label>
          <input type="date" className={inputClass} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {cargando && <p className="text-sm text-neutral-500">Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!cargando && reporte && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Caja</h2>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-2xl font-semibold">${reporte.total.toFixed(2)}</p>
              <p className="text-sm text-neutral-500">{reporte.cantidadPagos} cobros en el período</p>
              <div className="mt-3 space-y-1 text-sm">
                {Object.entries(reporte.porMetodo).map(([metodo, monto]) => (
                  <div key={metodo} className="flex justify-between">
                    <span>{metodo}</span>
                    <span>${monto.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Turnos atendidos sin cobrar ({reporte.turnosSinCobrar.length})
            </h2>
            <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {reporte.turnosSinCobrar.map((t) => (
                <Link
                  key={t.id}
                  href={`/turnos/${t.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span>
                    {new Date(t.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })} · {t.horaInicio} ·{" "}
                    {t.paciente}
                  </span>
                  <span className="text-neutral-500">{t.medico}</span>
                </Link>
              ))}
              {reporte.turnosSinCobrar.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-neutral-500">
                  No hay turnos atendidos sin cobrar en este período.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
