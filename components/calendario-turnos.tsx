"use client";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CalendarDays,
  Check,
  X,
  Phone,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useHoy, useRecurso, fetchJSON, mensajeError } from "@/lib/cliente";
import { sumarDias } from "@/lib/fecha";

type TurnoCal = {
  id: string;
  medicoId: string;
  medicoNombre: string;
  medicoColor: string;
  pacienteNombre: string;
  pacienteTelefono: string | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  version: number;
  canalReserva: string;
};
type MedicoCal = {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  color: string;
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
function diaBonito(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function TarjetaTurno({
  turno: t,
  clase,
  style,
  puedeConfirmar,
  ocupado,
  resolver,
}: {
  turno: TurnoCal;
  clase: string;
  style?: CSSProperties;
  puedeConfirmar: boolean;
  ocupado: boolean;
  resolver: (t: TurnoCal, estado: "CONFIRMADO" | "CANCELADO") => void;
}) {
  const router = useRouter();
  const nuevo = t.estado === "PENDIENTE";
  return (
    <article
      className={`${clase} appointment-event ${minutos(t.horaFin) - minutos(t.horaInicio) < 15 ? "compact" : ""}`}
      data-estado={t.estado}
      data-turno-id={t.id}
      style={
        {
          ...style,
          "--medico-color": t.medicoColor || "#0f766e",
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="event-open"
        onClick={() => router.push(`/turnos/${t.id}`)}
        aria-label={`${t.horaInicio}–${t.horaFin} ${t.pacienteNombre} · ${t.estado}`}
      >
        <span className="event-time">
          {t.horaInicio}–{t.horaFin}
        </span>
        <span className="event-name">{t.pacienteNombre}</span>
        <span className="event-doctor">{t.medicoNombre}</span>
        <span className="event-state">
          {nuevo
            ? "Por confirmar"
            : t.estado === "CONFIRMADO"
              ? "Confirmado"
              : t.estado === "CANCELADO"
                ? "Cancelado"
                : t.estado === "ATENDIDO"
                  ? "Atendido"
                  : "Ausente"}
        </span>
      </button>
      {puedeConfirmar && nuevo && (
        <div className="event-actions">
          <button
            type="button"
            disabled={ocupado}
            aria-label={`Cancelar turno de ${t.pacienteNombre}`}
            title="Cancelar turno"
            onClick={() => resolver(t, "CANCELADO")}
          >
            <X size={18} />
          </button>
          <button
            type="button"
            disabled={ocupado}
            aria-label={`Confirmar turno de ${t.pacienteNombre}`}
            title="Confirmar turno"
            onClick={() => resolver(t, "CONFIRMADO")}
          >
            <Check size={18} />
          </button>
        </div>
      )}
      {t.estado === "CANCELADO" && (
        <div className="event-phone">
          <Phone size={16} />
          {t.pacienteTelefono ? (
            <a href={`tel:${t.pacienteTelefono.replace(/[^+\d]/g, "")}`}>
              {t.pacienteTelefono}
            </a>
          ) : (
            <span>Sin teléfono registrado</span>
          )}
        </div>
      )}
    </article>
  );
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
  const [ocupado, setOcupado] = useState("");
  const [error, setError] = useState("");
  const [canceladoReciente, setCanceladoReciente] = useState<TurnoCal | null>(
    null,
  );
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
    : [
        {
          id: "__propio__",
          nombre: "Mi",
          apellido: "agenda",
          activo: true,
          color: "#0f766e",
        },
      ];
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
  const escala = 6,
    alto = (max - min) * escala;
  const filas = Array.from(
    { length: Math.ceil((max - min) / 30) },
    (_, i) => min + i * 30,
  );
  const dias = desde
    ? Array.from({ length: vista === "semana" ? 7 : 1 }, (_, i) =>
        sumarDias(desde, i),
      )
    : [];
  async function resolver(t: TurnoCal, estado: "CONFIRMADO" | "CANCELADO") {
    if (ocupado) return;
    setOcupado(t.id);
    setError("");
    try {
      await fetchJSON(`/api/turnos/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, version: t.version }),
      });
      if (estado === "CANCELADO") setCanceladoReciente({ ...t, estado });
      recurso.refrescar();
      router.refresh();
    } catch (e) {
      setError(mensajeError(e));
      recurso.refrescar();
    } finally {
      setOcupado("");
    }
  }
  const tarjeta = (t: TurnoCal, clase: string, style?: CSSProperties) => (
    <TarjetaTurno
      key={t.id}
      turno={t}
      clase={clase}
      style={style}
      puedeConfirmar={mostrarFiltroMedicos}
      ocupado={!!ocupado}
      resolver={resolver}
    />
  );
  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <button
          aria-label="Período anterior"
          disabled={!fecha}
          onClick={() => setDia(sumarDias(fecha, vista === "dia" ? -1 : -7))}
        >
          <ChevronLeft size={18} />
        </button>
        <label className="calendar-date">
          Fecha
          <input
            type="date"
            disabled={!hoy}
            value={fecha}
            onChange={(e) => {
              setDia(e.target.value);
              setCanceladoReciente(null);
            }}
          />
        </label>
        <button
          aria-label="Período siguiente"
          disabled={!fecha}
          onClick={() => setDia(sumarDias(fecha, vista === "dia" ? 1 : 7))}
        >
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setDia(hoy)}>Hoy</button>
        <label className="flex items-center gap-2">
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
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>
      <p className="px-4 py-2 text-sm text-neutral-500">
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
              <i
                className="doctor-color-dot"
                style={{ backgroundColor: m.color }}
              />
              {m.apellido}
              {!m.activo && " (inactivo)"}
            </label>
          ))}
        </div>
      )}
      {(error || recurso.error || medicos.error) && (
        <p role="alert" className="notice notice-error m-4">
          {error || recurso.error || medicos.error}
        </p>
      )}
      {canceladoReciente && recurso.data && !recurso.error && (
        <div className="recent-cancellation m-4" role="status">
          <p>Turno cancelado. Podés llamar al paciente:</p>
          {tarjeta(canceladoReciente, "cancelled-event")}
          <button
            className="text-sm underline"
            onClick={() => setCanceladoReciente(null)}
          >
            Cerrar aviso
          </button>
        </div>
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
                          style={{ top: (m - min) * escala }}
                        >
                          {hora(m)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {columnas.map((c) => (
                    <div key={c.id} className="calendar-doctor-column">
                      <p className="calendar-doctor-name">
                        <i
                          className="doctor-color-dot"
                          style={{ backgroundColor: c.color }}
                        />
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
                              style={{
                                top: (m - min) * escala,
                                height: 30 * escala,
                              }}
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
                              style={{
                                top: (m - min) * escala,
                                height: 30 * escala,
                              }}
                            />
                          ),
                        )}
                        {activos
                          .filter(
                            (t) => c.id === "__propio__" || t.medicoId === c.id,
                          )
                          .map((t) =>
                            tarjeta(t, "calendar-event", {
                              top: (minutos(t.horaInicio) - min) * escala,
                              height: Math.max(
                                28,
                                (minutos(t.horaFin) - minutos(t.horaInicio)) *
                                  escala,
                              ),
                            }),
                          )}
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
                        .map((t) => tarjeta(t, "week-event"))}
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
                  .map((t) => tarjeta(t, "calendar-mobile-event"))}
                {!activos.some((t) => t.fecha.slice(0, 10) === d) && (
                  <div className="empty-state">
                    <CalendarDays size={25} />
                    <p>No hay turnos para este día.</p>
                    {mostrarFiltroMedicos && (
                      <button
                        className="text-link mt-3"
                        onClick={() => router.push(`/turnos/nuevo?fecha=${d}`)}
                      >
                        Reservar un turno
                        <ChevronRight size={16} />
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
          <i style={{ background: "#9ca3af" }} />
          Gris: por confirmar
        </span>
        <span>Color del médico: confirmado</span>
      </div>
      {cancelados.length > 0 && (
        <section className="calendar-cancelled">
          <h3>Turnos cancelados ({cancelados.length})</h3>
          <div className="cancelled-grid">
            {cancelados.map((t) => tarjeta(t, "cancelled-event"))}
          </div>
        </section>
      )}
    </div>
  );
}
