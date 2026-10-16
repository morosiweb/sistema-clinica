"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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

type MedicoCal = { id: string; nombre: string; apellido: string };

type Vista = "dia" | "semana";

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function lunesDeLaSemana(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00.000Z`);
  const diaSemana = d.getUTCDay(); // 0 = domingo
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  return sumarDias(fechaISO, offset);
}

function generarFranjas(desdeMin: number, hastaMin: number, pasoMin: number): string[] {
  const franjas: string[] = [];
  for (let t = desdeMin; t < hastaMin; t += pasoMin) {
    const h = Math.floor(t / 60)
      .toString()
      .padStart(2, "0");
    const m = (t % 60).toString().padStart(2, "0");
    franjas.push(`${h}:${m}`);
  }
  return franjas;
}

const FRANJAS = generarFranjas(8 * 60, 20 * 60, 30);

export function CalendarioTurnos({ mostrarFiltroMedicos }: { mostrarFiltroMedicos: boolean }) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("dia");
  const [fecha, setFecha] = useState("");
  const [medicos, setMedicos] = useState<MedicoCal[]>([]);
  const [medicosSeleccionados, setMedicosSeleccionados] = useState<string[]>([]);
  const [turnos, setTurnos] = useState<TurnoCal[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setFecha(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (!mostrarFiltroMedicos) return;
    fetch("/api/medicos")
      .then((r) => r.json())
      .then((ms: (MedicoCal & { activo: boolean })[]) => setMedicos(ms.filter((m) => m.activo)));
  }, [mostrarFiltroMedicos]);

  const cargarTurnos = useCallback(async () => {
    if (!fecha) return;
    const desde = vista === "semana" ? lunesDeLaSemana(fecha) : fecha;
    const hasta = vista === "semana" ? sumarDias(desde, 6) : fecha;
    setCargando(true);
    const params = new URLSearchParams({ desde, hasta });
    if (mostrarFiltroMedicos && medicosSeleccionados.length > 0) {
      params.set("medicoIds", medicosSeleccionados.join(","));
    }
    const res = await fetch(`/api/turnos/calendario?${params}`);
    const data = await res.json();
    setTurnos(Array.isArray(data) ? data : []);
    setCargando(false);
  }, [fecha, vista, medicosSeleccionados, mostrarFiltroMedicos]);

  useEffect(() => {
    cargarTurnos();
  }, [cargarTurnos]);

  function toggleMedico(id: string) {
    setMedicosSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const columnas: MedicoCal[] =
    mostrarFiltroMedicos && medicos.length > 0
      ? medicosSeleccionados.length > 0
        ? medicos.filter((m) => medicosSeleccionados.includes(m.id))
        : medicos
      : [];

  function irATurno(id: string) {
    router.push(`/turnos/${id}`);
  }

  function irANuevoTurno(medicoId?: string, fechaSlot?: string, hora?: string) {
    const params = new URLSearchParams();
    if (medicoId) params.set("medicoId", medicoId);
    if (fechaSlot) params.set("fecha", fechaSlot);
    if (hora) params.set("hora", hora);
    router.push(`/turnos/nuevo${params.toString() ? `?${params}` : ""}`);
  }

  const diasSemana = vista === "semana" ? Array.from({ length: 7 }, (_, i) => sumarDias(lunesDeLaSemana(fecha), i)) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFecha((f) => sumarDias(f, vista === "semana" ? -7 : -1))}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
          >
            ←
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button
            onClick={() => setFecha((f) => sumarDias(f, vista === "semana" ? 7 : 1))}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
          >
            →
          </button>
          <button
            onClick={() => setFecha(new Date().toISOString().slice(0, 10))}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-neutral-300 p-0.5 text-sm dark:border-neutral-700">
          <button
            onClick={() => setVista("dia")}
            className={`rounded px-3 py-1 ${vista === "dia" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : ""}`}
          >
            Día
          </button>
          <button
            onClick={() => setVista("semana")}
            className={`rounded px-3 py-1 ${vista === "semana" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : ""}`}
          >
            Semana
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {mostrarFiltroMedicos && medicos.length > 0 && (
          <aside className="w-40 shrink-0 space-y-1">
            <p className="mb-1 text-xs font-medium text-neutral-500">Médicos</p>
            <button
              onClick={() => setMedicosSeleccionados([])}
              className={`block w-full rounded px-2 py-1 text-left text-xs ${
                medicosSeleccionados.length === 0 ? "bg-neutral-100 dark:bg-neutral-800" : ""
              }`}
            >
              Todos
            </button>
            {medicos.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <input
                  type="checkbox"
                  checked={medicosSeleccionados.includes(m.id)}
                  onChange={() => toggleMedico(m.id)}
                />
                {m.apellido}, {m.nombre}
              </label>
            ))}
          </aside>
        )}

        <div className="flex-1 overflow-x-auto">
          {cargando ? (
            <p className="text-sm text-neutral-500">Cargando...</p>
          ) : vista === "dia" ? (
            <VistaDia
              franjas={FRANJAS}
              columnas={columnas.length > 0 ? columnas : [{ id: "__propio__", nombre: "", apellido: "" }]}
              mostrarColumnas={columnas.length > 0}
              turnos={turnos}
              onClickTurno={irATurno}
              onClickVacio={(medicoId, hora) => irANuevoTurno(medicoId === "__propio__" ? undefined : medicoId, fecha, hora)}
            />
          ) : (
            <VistaSemana dias={diasSemana} turnos={turnos} onClickTurno={irATurno} />
          )}
        </div>
      </div>
    </div>
  );
}

function VistaDia({
  franjas,
  columnas,
  mostrarColumnas,
  turnos,
  onClickTurno,
  onClickVacio,
}: {
  franjas: string[];
  columnas: MedicoCal[];
  mostrarColumnas: boolean;
  turnos: TurnoCal[];
  onClickTurno: (id: string) => void;
  onClickVacio: (medicoId: string, hora: string) => void;
}) {
  return (
    <div className="min-w-[500px]" style={{ display: "grid", gridTemplateColumns: `60px repeat(${columnas.length}, 1fr)` }}>
      <div />
      {columnas.map((c) => (
        <div key={c.id} className="truncate px-2 pb-2 text-center text-xs font-medium">
          {mostrarColumnas ? `${c.apellido}, ${c.nombre}` : "Hoy"}
        </div>
      ))}

      {franjas.map((hora) => (
        <Fragment key={hora}>
          <div className="border-t border-neutral-100 py-2 pr-2 text-right text-xs text-neutral-400 dark:border-neutral-900">
            {hora}
          </div>
          {columnas.map((c) => {
            const turno = turnos.find(
              (t) => t.horaInicio === hora && (c.id === "__propio__" || t.medicoId === c.id)
            );
            return (
              <button
                key={`${c.id}-${hora}`}
                onClick={() => (turno ? onClickTurno(turno.id) : onClickVacio(c.id, hora))}
                className="min-h-[36px] border-t border-l border-neutral-100 px-1 py-1 text-left text-xs hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
              >
                {turno && (
                  <span
                    className={`block truncate rounded px-1.5 py-0.5 ${
                      turno.estado === "CANCELADO"
                        ? "bg-neutral-100 text-neutral-400 line-through dark:bg-neutral-800"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    }`}
                  >
                    {turno.pacienteNombre}
                  </span>
                )}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function VistaSemana({
  dias,
  turnos,
  onClickTurno,
}: {
  dias: string[];
  turnos: TurnoCal[];
  onClickTurno: (id: string) => void;
}) {
  return (
    <div className="grid min-w-[700px] grid-cols-7 gap-2">
      {dias.map((dia) => {
        const turnosDelDia = turnos
          .filter((t) => t.fecha.slice(0, 10) === dia)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        return (
          <div key={dia} className="space-y-1">
            <p className="text-center text-xs font-medium">
              {new Date(`${dia}T00:00:00.000Z`).toLocaleDateString("es-AR", {
                timeZone: "UTC",
                weekday: "short",
                day: "numeric",
              })}
            </p>
            <div className="min-h-[200px] space-y-1 rounded-md border border-neutral-100 p-1 dark:border-neutral-900">
              {turnosDelDia.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onClickTurno(t.id)}
                  className={`block w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight ${
                    t.estado === "CANCELADO"
                      ? "bg-neutral-100 text-neutral-400 line-through dark:bg-neutral-800"
                      : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
                  }`}
                >
                  <span className="font-medium">{t.horaInicio}</span> {t.pacienteNombre}
                  <br />
                  <span className="opacity-70">{t.medicoNombre}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
