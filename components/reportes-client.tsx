"use client";

import { PageHeading } from "@/components/page-heading";
import { useState } from "react";
import { useHoy, useRecurso } from "@/lib/cliente";
import Link from "next/link";

type Reporte = {
  total: number;
  porMetodo: Record<string, number>;
  cantidadPagos: number;
  cantidadAnulaciones: number;
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
  const hoy = useHoy();
  const [inicio, setDesde] = useState("");
  const [fin, setHasta] = useState("");
  const desde = inicio || (hoy ? `${hoy.slice(0, 7)}-01` : ""),
    hasta = fin || hoy;
  const {
    data: reporte,
    cargando,
    error,
  } = useRecurso<Reporte>(
    desde && hasta
      ? `/api/reportes/caja?${new URLSearchParams({ desde, hasta })}`
      : null,
  );

  return (
    <div className="record-page">
      <PageHeading
        title="Reportes"
        description="Consultá los cobros y la actividad de caja del período."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            htmlFor="reportes-client-campo-1"
            className="text-xs text-neutral-500"
          >
            Desde
          </label>
          <input
            id="reportes-client-campo-1"
            type="date"
            className={inputClass}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="reportes-client-campo-2"
            className="text-xs text-neutral-500"
          >
            Hasta
          </label>
          <input
            id="reportes-client-campo-2"
            type="date"
            className={inputClass}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
      </div>

      {cargando && <p className="text-sm text-neutral-500">Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!cargando && reporte && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Caja</h2>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-2xl font-semibold">
                ${reporte.total.toFixed(2)}
              </p>
              <p className="text-sm text-neutral-500">
                {reporte.cantidadPagos} cobros y {reporte.cantidadAnulaciones}{" "}
                anulaciones en el período
              </p>
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
                    {new Date(t.fecha).toLocaleDateString("es-AR", {
                      timeZone: "UTC",
                    })}{" "}
                    · {t.horaInicio} · {t.paciente}
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
