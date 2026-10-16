"use client";
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
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          aria-label="Período anterior"
          disabled={!fecha}
          onClick={() => setDia(sumarDias(fecha, vista === "dia" ? -1 : -7))}
        >
          ←
        </button>
        <label className="text-sm">
          Fecha{" "}
          <input
            type="date"
            className="rounded border p-2 dark:bg-neutral-900"
            value={fecha}
            onChange={(e) => setDia(e.target.value)}
          />
        </label>
        <button
          aria-label="Período siguiente"
          disabled={!fecha}
          onClick={() => setDia(sumarDias(fecha, vista === "dia" ? 1 : 7))}
        >
          →
        </button>
        <button className="text-sm underline" onClick={() => setDia(hoy)}>
          Hoy
        </button>
        <label className="text-sm">
          Vista{" "}
          <select
            value={vista}
            onChange={(e) => setVista(e.target.value as "dia" | "semana")}
            className="rounded border p-2 dark:bg-neutral-900"
          >
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
          </select>
        </label>
        <button onClick={recurso.refrescar} className="text-sm underline">
          Actualizar
        </button>
      </div>
      {mostrarFiltroMedicos && (
        <div className="flex flex-wrap gap-3 text-xs">
          <button className="underline" onClick={() => setSeleccionados([])}>
            Todos
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
              />{" "}
              {m.apellido}
              {!m.activo && " (inactivo)"}
            </label>
          ))}
        </div>
      )}
      {(recurso.error || medicos.error) && (
        <p role="alert" className="text-sm text-red-600">
          {recurso.error || medicos.error}
        </p>
      )}
      {recurso.cargando || (mostrarFiltroMedicos && medicos.cargando) ? (
        <p>Cargando agenda…</p>
      ) : vista === "dia" ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[550px]">
            <div className="w-16 shrink-0 pt-8">
              <div className="relative" style={{ height: alto }}>
                {filas.map((m) => (
                  <span
                    key={m}
                    className="absolute text-xs text-neutral-500"
                    style={{ top: (m - min) * 2 }}
                  >
                    {hora(m)}
                  </span>
                ))}
              </div>
            </div>
            {columnas.map((c) => (
              <div key={c.id} className="min-w-44 flex-1">
                <p className="h-8 text-center text-xs font-medium">
                  {c.apellido}, {c.nombre}
                </p>
                <div className="relative border-l" style={{ height: alto }}>
                  {filas.map((m) =>
                    mostrarFiltroMedicos ? (
                      <button
                        key={m}
                        aria-label={`Reservar con ${c.apellido} a las ${hora(m)}`}
                        className="absolute left-0 w-full border-t border-neutral-100 text-left text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                        style={{ top: (m - min) * 2, height: 60 }}
                        onClick={() =>
                          router.push(
                            `/turnos/nuevo?${new URLSearchParams({ medicoId: c.id, fecha, hora: hora(m) })}`,
                          )
                        }
                      />
                    ) : (
                      <div
                        key={m}
                        className="absolute w-full border-t border-neutral-100 dark:border-neutral-800"
                        style={{ top: (m - min) * 2 }}
                      />
                    ),
                  )}
                  {activos
                    .filter((t) => c.id === "__propio__" || t.medicoId === c.id)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => abrir(t)}
                        title={`${t.horaInicio}–${t.horaFin} ${t.pacienteNombre}`}
                        className="absolute left-1 right-1 overflow-hidden rounded border border-blue-300 bg-blue-100 px-2 text-left text-xs text-blue-950 dark:bg-blue-950 dark:text-blue-100"
                        style={{
                          top: (minutos(t.horaInicio) - min) * 2,
                          height: Math.max(
                            20,
                            (minutos(t.horaFin) - minutos(t.horaInicio)) * 2,
                          ),
                        }}
                      >
                        <span className="font-semibold">
                          {t.horaInicio}–{t.horaFin}
                        </span>{" "}
                        {t.pacienteNombre} · {t.estado}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        desde && (
          <div className="grid gap-2 overflow-x-auto md:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => sumarDias(desde, i)).map(
              (d) => (
                <div key={d} className="space-y-2 rounded border p-2">
                  <p className="text-xs font-medium">
                    {new Date(`${d}T00:00:00Z`).toLocaleDateString("es-AR", {
                      timeZone: "UTC",
                      weekday: "short",
                      day: "numeric",
                    })}
                  </p>
                  {activos
                    .filter((t) => t.fecha.slice(0, 10) === d)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => abrir(t)}
                        className="block w-full rounded bg-blue-100 p-2 text-left text-xs text-blue-950 dark:bg-blue-950 dark:text-blue-100"
                      >
                        {t.horaInicio}–{t.horaFin}
                        <br />
                        {t.pacienteNombre}
                        <br />
                        {t.medicoNombre}
                      </button>
                    ))}
                </div>
              ),
            )}
          </div>
        )
      )}
      {cancelados.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">
            Turnos cancelados ({cancelados.length})
          </summary>
          <div className="mt-2 space-y-1">
            {cancelados.map((t) => (
              <button
                key={t.id}
                onClick={() => abrir(t)}
                className="block text-sm text-neutral-500 underline"
              >
                {t.fecha.slice(0, 10)} · {t.horaInicio} · {t.pacienteNombre} ·{" "}
                {t.medicoNombre}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
