"use client";
import Link from "next/link";
import { useState } from "react";
import {
  EVENTO_TURNOS,
  fetchJSON,
  mensajeError,
  notificarTurnos,
  useRecurso,
} from "@/lib/cliente";
type Entrada = {
  id: string;
  turnoId: string;
  tipo: string;
  paciente: string;
  telefono: string | null;
  medico: string;
  fecha: string;
  horaInicio: string;
  version: number;
  error: string | null;
};
type Datos = {
  resumen: { reservas: number; reprogramaciones: number; avisos: number };
  hayMas: boolean;
  entradas: Entrada[];
};
export function BandejaPendientes() {
  const [tipo, setTipo] = useState("reservas"),
    [abierto, setAbierto] = useState(false),
    [pagina, setPagina] = useState(1),
    [ocupado, setOcupado] = useState(""),
    [aviso, setAviso] = useState("");
  const recurso = useRecurso<Datos>(
    `/api/turnos/pendientes?${new URLSearchParams({ tipo, pagina: String(pagina) })}`,
    10000,
    EVENTO_TURNOS,
  );
  async function resolver(e: Entrada, estado?: "CONFIRMADO" | "CANCELADO") {
    setOcupado(e.id);
    setAviso("");
    try {
      if (estado)
        await fetchJSON(`/api/turnos/${e.turnoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado, version: e.version }),
        });
      else {
        const r = await fetchJSON<{ mensaje: string }>(
          "/api/turnos/pendientes/reintentar",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: e.id, tipo: e.tipo }),
          },
        );
        setAviso(r.mensaje);
      }
      notificarTurnos();
      recurso.refrescar();
    } catch (error) {
      setAviso(mensajeError(error));
      recurso.refrescar();
    } finally {
      setOcupado("");
    }
  }
  return (
    <section className="surface p-5 mb-6 space-y-4">
      <button
        type="button"
        className="text-link"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        Pendientes de secretaría{" "}
        {recurso.data
          ? `(${recurso.data.resumen.reservas + recurso.data.resumen.reprogramaciones + recurso.data.resumen.avisos})`
          : ""}
      </button>
      {abierto && (
        <>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Tipos de pendientes"
          >
            {(
              [
                ["reservas", "Por confirmar"],
                ["reprogramaciones", "Por reprogramar"],
                ["avisos", "Avisos fallidos"],
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                className={`btn btn-small ${tipo === key ? "btn-primary" : "btn-outline"}`}
                aria-pressed={tipo === key}
                key={key}
                onClick={() => {
                  setTipo(key);
                  setPagina(1);
                }}
              >
                {label} ({recurso.data?.resumen[key] ?? "…"})
              </button>
            ))}
          </div>
          {(aviso || recurso.error) && (
            <p role="status" className="notice">
              {aviso || recurso.error}
            </p>
          )}
          {recurso.cargando && <p>Cargando pendientes…</p>}
          {recurso.data?.entradas.length === 0 && (
            <p>No hay pendientes en esta sección.</p>
          )}
          <div className="pending-list">
            {recurso.data?.entradas.map((e) => (
              <article
                className="patient-note space-y-2"
                key={`${e.tipo}:${e.id}`}
              >
                <p>
                  <strong>{e.paciente}</strong> · {e.fecha.slice(0, 10)} ·{" "}
                  {e.horaInicio} · {e.medico}
                </p>
                {e.error && <p>{e.error}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/turnos/${e.turnoId}`} className="text-link">
                    {tipo === "reprogramaciones"
                      ? "Reprogramar turno"
                      : "Abrir turno"}
                  </Link>
                  {e.telefono && (
                    <a
                      href={`tel:${e.telefono.replace(/[^+\d]/g, "")}`}
                      className="text-link"
                    >
                      Llamar: {e.telefono}
                    </a>
                  )}
                  {tipo === "reservas" && (
                    <>
                      <button
                        type="button"
                        disabled={!!ocupado}
                        onClick={() => {
                          void resolver(e, "CONFIRMADO");
                        }}
                        className="text-link"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        disabled={!!ocupado}
                        onClick={() => {
                          void resolver(e, "CANCELADO");
                        }}
                        className="text-link"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {tipo === "avisos" && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      disabled={!!ocupado}
                      onClick={() => {
                        void resolver(e);
                      }}
                    >
                      {ocupado === e.id ? "Reintentando…" : "Reintentar aviso"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>
            <span>Página {pagina}</span>
            <button
              disabled={!recurso.data?.hayMas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </section>
  );
}
