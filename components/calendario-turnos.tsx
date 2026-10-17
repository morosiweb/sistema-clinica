"use client";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import { EstadoBadge } from "@/components/estado-badge";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHoy, useRecurso } from "@/lib/cliente";
import { sumarDias } from "@/lib/fecha";

type TurnoCal = {
  id: string;
  medicoId: string;
  medicoNombre: string;
  pacienteNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
};
type MedicoCal = {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
};
function lunes(fecha: string) {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return sumarDias(fecha, d === 0 ? -6 : 1 - d);
}
function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}
function hora(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
}
export function CalendarioTurnos({
  mostrarFiltroMedicos,
}: {
  mostrarFiltroMedicos: boolean;
}) {
  const router = useRouter(),
    hoy = useHoy();
  const [dia, setDia] = useState("");
  const fecha = dia || hoy;
  const [vista, setVista] = useState<"dia" | "semana">("dia");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const medicos = useRecurso<MedicoCal[]>(
    mostrarFiltroMedicos ? "/api/medicos" : null,
  );
  const desde = fecha ? (vista === "semana" ? lunes(fecha) : fecha) : "";
  const hasta = desde ? (vista === "semana" ? sumarDias(desde, 6) : desde) : "";
  const params = new URLSearchParams({ desde, hasta });
  if (seleccionados.length) params.set("medicoIds", seleccionados.join(","));
  const recurso = useRecurso<TurnoCal[]>(
    desde ? `/api/turnos/calendario?${params}` : null,
    5000,
  );
  const turnos = recurso.data || [];
  const columnas = mostrarFiltroMedicos
    ? (medicos.data || []).filter(
        (m) => !seleccionados.length || seleccionados.includes(m.id),
      )
    : [{ id: "__propio__", nombre: "Mi", apellido: "agenda", activo: true }];
  const activos = turnos.filter((t) => t.estado !== "CANCELADO"),
    cancelados = turnos.filter((t) => t.estado === "CANCELADO");
  const min = Math.min(
    8 * 60,
    ...activos.map((t) => Math.floor(minutos(t.horaInicio) / 30) * 30),
  );
  const max = Math.max(
    20 * 60,
    ...activos.map((t) => Math.ceil(minutos(t.horaFin) / 30) * 30),
  );
  const alto = (max - min) * 2;
  const filas = Array.from(
    { length: Math.ceil((max - min) / 30) },
    (_, i) => min + i * 30,
  );
  function abrir(t: TurnoCal) {
    router.push(`/turnos/${t.id}`);
  }

  const dias = desde
    ? Array.from({ length: vista === "semana" ? 7 : 1 }, (_, i) =>
        sumarDias(desde, i),
      )
    : [];
  function diaBonito(d: string) {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  }
  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <button
          aria-label="Período anterior"
          disabled={!fecha}
          onClick={() => setDia(sumarDias(fecha, vista === "dia" ? -1 : -7))}
        >
          <ChevronLeft size={16} />
        </button>
        <label className="calendar-date">
          Fecha
          <input
            type="date"
            disabled={!hoy}
            value={fecha}
            onChange={(e) => setDia(e.target.value)}
          />
        </label>
        <button
          aria-label="Período siguiente"
          disabled={!fecha}
          onClick={() => setDia(sumarDias(fecha, vista === "dia" ? 1 : 7))}
        >
          <ChevronRight size={16} />
        </button>
        <button onClick={() => setDia(hoy)}>Hoy</button>
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          Vista
          <select
            aria-label="Vista"
            value={vista}
            onChange={(e) => setVista(e.target.value as "dia" | "semana")}
          >
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
          </select>
        </label>
        <button className="refresh-calendar" onClick={recurso.refrescar}>
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>
      <p className="px-4 py-2 text-xs text-neutral-500">
        {recurso.error
          ? recurso.data
            ? "No pudimos actualizar la agenda. Se muestran los últimos datos disponibles; reintentaremos automáticamente."
            : "La agenda no está actualizada. Usá Actualizar para volver a intentarlo."
          : "La agenda se actualiza automáticamente cada 5 segundos."}
      </p>
      {mostrarFiltroMedicos && (
        <div className="calendar-doctors">
          <button onClick={() => setSeleccionados([])}>
            Todos los médicos
          </button>
          {medicos.data?.map((m) => (
            <label key={m.id}>
              <input
                type="checkbox"
                checked={seleccionados.includes(m.id)}
                onChange={() =>
                  setSeleccionados((v) =>
                    v.includes(m.id)
                      ? v.filter((x) => x !== m.id)
                      : [...v, m.id],
                  )
                }
              />
              {m.apellido}
              {!m.activo && " (inactivo)"}
            </label>
          ))}
        </div>
      )}
      {(recurso.error || medicos.error) && (
        <p role="alert" className="notice notice-error m-4">
          {recurso.error || medicos.error}
        </p>
      )}
      {recurso.cargando || (mostrarFiltroMedicos && medicos.cargando) ? (
        <p className="loading-state" role="status">
          Cargando agenda…
        </p>
      ) : (
        <>
          <div className="calendar-desktop">
            <div className="calendar-scroll">
              {vista === "dia" ? (
                <div className="calendar-day-grid">
                  <div className="calendar-time-axis">
                    <div className="relative" style={{ height: alto }}>
                      {filas.map((m) => (
                        <span
                          key={m}
                          className="absolute"
                          style={{ top: (m - min) * 2 }}
                        >
                          {hora(m)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {columnas.map((c) => (
                    <div key={c.id} className="calendar-doctor-column">
                      <p className="calendar-doctor-name">
                        {c.id === "__propio__"
                          ? "Mi agenda"
                          : `${c.apellido}, ${c.nombre}`}
                      </p>
                      <div className="calendar-track" style={{ height: alto }}>
                        {filas.map((m) =>
                          mostrarFiltroMedicos ? (
                            <button
                              key={m}
                              aria-label={`Reservar con ${c.apellido} a las ${hora(m)}`}
                              className="calendar-line"
                              style={{ top: (m - min) * 2 }}
                              onClick={() =>
                                router.push(
                                  `/turnos/nuevo?${new URLSearchParams({ medicoId: c.id, fecha, hora: hora(m) })}`,
                                )
                              }
                            />
                          ) : (
                            <div
                              key={m}
                              className="calendar-line"
                              style={{ top: (m - min) * 2 }}
                            />
                          ),
                        )}
                        {activos
                          .filter(
                            (t) => c.id === "__propio__" || t.medicoId === c.id,
                          )
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => abrir(t)}
                              aria-label={`${t.horaInicio}–${t.horaFin} ${t.pacienteNombre} · ${t.estado}`}
                              title={`${t.horaInicio}–${t.horaFin} ${t.pacienteNombre}`}
                              className="calendar-event"
                              data-estado={t.estado}
                              style={{
                                top: (minutos(t.horaInicio) - min) * 2,
                                height: Math.max(
                                  20,
                                  (minutos(t.horaFin) - minutos(t.horaInicio)) *
                                    2,
                                ),
                              }}
                            >
                              <span className="event-time">
                                {t.horaInicio}–{t.horaFin}
                              </span>{" "}
                              <span className="event-name">
                                {t.pacienteNombre}
                              </span>{" "}
                              <span className="event-state">· {t.estado}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="calendar-week">
                  {dias.map((d) => (
                    <div key={d} className="calendar-week-day">
                      <p>{diaBonito(d)}</p>
                      {activos
                        .filter((t) => t.fecha.slice(0, 10) === d)
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => abrir(t)}
                            className="week-event"
                          >
                            <strong>
                              {t.horaInicio}–{t.horaFin}
                            </strong>
                            {t.pacienteNombre}
                            <br />
                            {t.medicoNombre}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="calendar-mobile-list">
            {dias.map((d) => (
              <section key={d}>
                <h3>{diaBonito(d)}</h3>
                {activos
                  .filter((t) => t.fecha.slice(0, 10) === d)
                  .map((t) => (
                    <button
                      key={t.id}
                      className="calendar-mobile-event"
                      onClick={() => abrir(t)}
                    >
                      <span>
                        {t.horaInicio}
                        <small>{t.horaFin}</small>
                      </span>
                      <span>
                        {t.pacienteNombre}
                        <small>{t.medicoNombre}</small>
                      </span>
                      <EstadoBadge estado={t.estado} />
                    </button>
                  ))}
                {!activos.some((t) => t.fecha.slice(0, 10) === d) && (
                  <div className="empty-state">
                    <CalendarDays size={25} />
                    <p>No hay turnos para este día.</p>
                    {mostrarFiltroMedicos && (
                      <button
                        className="text-link mt-3"
                        onClick={() => router.push(`/turnos/nuevo?fecha=${d}`)}
                      >
                        Reservar un turno <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      <div className="calendar-legend">
        <span>
          <i />
          Por atender
        </span>
        <span>
          <i />
          Atendido
        </span>
        <span>
          <i />
          Ausente
        </span>
      </div>
      {cancelados.length > 0 && (
        <details className="calendar-cancelled">
          <summary>Turnos cancelados ({cancelados.length})</summary>
          <div className="mt-3 space-y-2">
            {cancelados.map((t) => (
              <button
                key={t.id}
                onClick={() => abrir(t)}
                className="block text-left"
              >
                {diaBonito(t.fecha.slice(0, 10))} · {t.horaInicio} ·{" "}
                {t.pacienteNombre} · {t.medicoNombre}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
