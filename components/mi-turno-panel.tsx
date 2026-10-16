"use client";

import { useEffect, useState, useCallback } from "react";
import { EstadoBadge } from "@/components/estado-badge";
import { ReprogramarForm } from "@/components/reprogramar-form";

type Turno = {
  id: string;
  medicoId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  motivoConsulta: string | null;
  medico: { nombre: string; apellido: string; especialidad: { nombre: string } };
};

export function MiTurnoPanel({ token }: { token: string }) {
  const [paciente, setPaciente] = useState<{ nombre: string; apellido: string; dni: string } | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [linkNuevo, setLinkNuevo] = useState<string | null>(null);
  const [reprogramando, setReprogramando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch(`/api/publico/mi-turno/${token}`);
    const data = await res.json().catch(() => null);
    setCargando(false);
    if (!res.ok) {
      setError(data?.error ?? "No se pudo cargar.");
      return;
    }
    setPaciente(data.paciente);
    setTurnos(data.turnos);
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cancelar(turnoId: string) {
    if (!confirm("¿Cancelar este turno?")) return;
    const res = await fetch(`/api/publico/mi-turno/${token}/cancelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnoId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error ?? "No se pudo cancelar.");
      return;
    }
    cargar();
  }

  async function reprogramar(turnoId: string, medicoId: string, fecha: string, horaInicio: string) {
    const res = await fetch(`/api/publico/mi-turno/${token}/reprogramar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnoId, medicoId, fecha, horaInicio }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error ?? "No se pudo reprogramar.");
      return;
    }
    setReprogramando(null);
    cargar();
  }

  async function regenerar() {
    if (!confirm("Esto invalida tu link actual y te da uno nuevo. ¿Continuar?")) return;
    const res = await fetch(`/api/publico/mi-turno/${token}/regenerar`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error ?? "No se pudo regenerar.");
      return;
    }
    setLinkNuevo(data.linkAcceso);
  }

  if (cargando) return <p className="px-6 py-10 text-sm text-neutral-500">Cargando...</p>;

  if (linkNuevo) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="mb-4 text-xl font-semibold">Nuevo link generado</h1>
        <p className="mb-4 text-sm text-neutral-500">
          El link anterior ya no funciona. Guardá este, es el único válido de ahora en más.
        </p>
        <a href={linkNuevo} className="block break-all rounded-md border border-neutral-200 p-4 text-sm underline dark:border-neutral-800">
          {typeof window !== "undefined" ? window.location.origin : ""}
          {linkNuevo}
        </a>
      </div>
    );
  }

  if (error || !paciente) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-neutral-500">{error ?? "Link inválido."}</p>
        <a href="/mi-turno/recuperar" className="mt-4 inline-block text-sm underline">
          Recuperar mi acceso
        </a>
      </div>
    );
  }

  const ahora = Date.now();
  const futuros = turnos.filter((t) => new Date(`${t.fecha.slice(0, 10)}T${t.horaInicio}:00Z`).getTime() >= ahora);
  const pasados = turnos.filter((t) => new Date(`${t.fecha.slice(0, 10)}T${t.horaInicio}:00Z`).getTime() < ahora);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {paciente.apellido}, {paciente.nombre}
          </h1>
          <p className="text-sm text-neutral-500">DNI {paciente.dni}</p>
        </div>
        <a
          href="/reservar"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Nuevo turno
        </a>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Próximos turnos</h2>
      <div className="mb-6 divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {futuros.map((t) => (
          <div key={t.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p>
                  {new Date(t.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })} · {t.horaInicio}
                </p>
                <p className="text-neutral-500">
                  {t.medico.apellido}, {t.medico.nombre} · {t.medico.especialidad.nombre}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <EstadoBadge estado={t.estado} />
                {t.estado !== "CANCELADO" && (
                  <>
                    <button
                      onClick={() => setReprogramando(reprogramando === t.id ? null : t.id)}
                      className="underline"
                    >
                      Reprogramar
                    </button>
                    <button onClick={() => cancelar(t.id)} className="text-red-600 underline">
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
            {reprogramando === t.id && (
              <div className="mt-3">
                <ReprogramarForm
                  medicoActualId={t.medicoId}
                  onCancelar={() => setReprogramando(null)}
                  onConfirmar={(medicoId, fecha, horaInicio) =>
                    reprogramar(t.id, medicoId, fecha, horaInicio)
                  }
                />
              </div>
            )}
          </div>
        ))}
        {futuros.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">No tenés turnos próximos.</p>
        )}
      </div>

      {pasados.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold">Historial</h2>
          <div className="mb-6 divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {pasados.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p>
                    {new Date(t.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })} · {t.horaInicio}
                  </p>
                  <p className="text-neutral-500">
                    {t.medico.apellido}, {t.medico.nombre}
                  </p>
                </div>
                <EstadoBadge estado={t.estado} />
              </div>
            ))}
          </div>
        </>
      )}

      <button onClick={regenerar} className="text-xs text-neutral-500 underline">
        ¿Creés que alguien más tiene este link? Regenerarlo
      </button>
    </div>
  );
}
