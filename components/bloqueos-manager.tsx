"use client";
import { useEffect, useRef, useState } from "react";
import {
  fetchJSON,
  mensajeError,
  useHoy,
  useRecurso,
  notificarTurnos,
} from "@/lib/cliente";
import type { ConflictoLicencia } from "@/lib/bloqueos";
type SolicitudLicencia = {
  url: string;
  method: "POST" | "PATCH";
  datos: Record<string, unknown>;
};
type Medico = { id: string; nombre: string; apellido: string };
type Bloqueo = {
  id: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  motivo: string;
  estado: string;
  medico: { nombre: string; apellido: string };
};
export function BloqueosManager({
  medicos,
  esMedico,
  medicoFijo,
}: {
  medicos: Medico[];
  esMedico: boolean;
  medicoFijo?: string;
}) {
  const hoy = useHoy();
  const [medicoId, setMedico] = useState(medicos[0]?.id || "");
  const [dia, setDia] = useState("");
  const [tipo, setTipo] = useState<"dia" | "horas" | "vacaciones">("dia");
  const [hasta, setHasta] = useState("");
  const [aviso, setAviso] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const recurso = useRecurso<Bloqueo[]>(
    medicoFijo
      ? `/api/bloqueos?medicoId=${encodeURIComponent(medicoFijo)}`
      : "/api/bloqueos",
  );
  const dialogo = useRef<HTMLDialogElement>(null);
  const [confirmacion, setConfirmacion] = useState<{
    solicitud: SolicitudLicencia;
    conflictos: ConflictoLicencia[];
  } | null>(null);
  useEffect(() => {
    if (confirmacion && !dialogo.current?.open) {
      dialogo.current?.showModal();
      dialogo.current
        ?.querySelector<HTMLButtonElement>("[data-cancelar]")
        ?.focus();
    } else if (!confirmacion && dialogo.current?.open) dialogo.current.close();
  }, [confirmacion]);
  async function guardarLicencia(
    solicitud: SolicitudLicencia,
    conflictos?: ConflictoLicencia[],
  ) {
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const res = await fetch(solicitud.url, {
        method: solicitud.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...solicitud.datos,
          ...(conflictos
            ? {
                confirmarReprogramacion: true,
                turnosConfirmados: conflictos.map((t) => ({
                  id: t.id,
                  version: t.version,
                })),
              }
            : {}),
        }),
      });
      const body = await res.json();
      if (
        res.status === 409 &&
        body.codigo === "TURNOS_COINCIDENTES" &&
        Array.isArray(body.conflictos)
      ) {
        if (confirmacion)
          setError(
            "La agenda cambió. Revisá la lista actualizada antes de confirmar.",
          );
        setConfirmacion({ solicitud, conflictos: body.conflictos });
        return;
      }
      if (!res.ok)
        throw new Error(body.error || "No se pudo guardar la licencia.");
      setConfirmacion(null);
      setMotivo("");
      setAviso(
        solicitud.datos.estado === "RECHAZADO"
          ? "La licencia quedó anulada."
          : "Ausencia guardada. Esos horarios ya no se pueden reservar." +
              (body.notificacionesProgramadas
                ? " Se enviará un correo con el enlace para reprogramar a los turnos afectados."
                : "") +
              (body.sinEmail
                ? " Hay " +
                  body.sinEmail +
                  " turno(s) de pacientes sin email: deben ser contactados por teléfono."
                : ""),
      );
      recurso.refrescar();
      notificarTurnos();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    await guardarLicencia({
      url: "/api/bloqueos",
      method: "POST",
      datos: {
        medicoId,
        fecha: dia || hoy,
        ...(tipo === "vacaciones" ? { fechaHasta: hasta || dia || hoy } : {}),
        horaInicio: tipo === "horas" ? inicio : "",
        horaFin: tipo === "horas" ? fin : "",
        motivo:
          motivo || (tipo === "vacaciones" ? "Vacaciones" : "Tiempo libre"),
      },
    });
  }
  async function resolver(id: string, estado: string) {
    await guardarLicencia({
      url: "/api/bloqueos/" + id,
      method: "PATCH",
      datos: { estado },
    });
  }
  const input = "mt-1 w-full rounded border p-2 dark:bg-neutral-900";
  return (
    <div className="space-y-6">
      <p className="text-sm">
        Las licencias se registran directamente y bloquean los horarios
        elegidos. Si coinciden con turnos, revisá la lista y confirmá el envío
        de los avisos por correo antes de continuar.
      </p>
      <form
        onSubmit={crear}
        className="grid gap-3 rounded border p-4 sm:grid-cols-2"
      >
        <label className="text-sm">
          Tipo de ausencia
          <select
            aria-label="Tipo de ausencia"
            className={input}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
          >
            <option value="dia">Día completo</option>
            <option value="horas">Tiempo libre por horas</option>
            <option value="vacaciones">Vacaciones (varios días)</option>
          </select>
        </label>
        <label className="text-sm">
          Médico
          <select
            required
            className={input}
            value={medicoId}
            disabled={!!medicoFijo}
            onChange={(e) => setMedico(e.target.value)}
          >
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.apellido}, {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Fecha
          <input
            required
            type="date"
            min={hoy}
            className={input}
            value={dia || hoy}
            onChange={(e) => setDia(e.target.value)}
          />
        </label>
        {tipo === "vacaciones" && (
          <label className="text-sm">
            Último día de vacaciones
            <input
              required
              aria-label="Último día de vacaciones"
              type="date"
              min={dia || hoy}
              className={input}
              value={hasta || dia || hoy}
              onChange={(e) => setHasta(e.target.value)}
            />
          </label>
        )}
        {tipo === "horas" && (
          <>
            <label className="text-sm">
              Hora de inicio
              <input
                type="time"
                required
                className={input}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Hora de fin
              <input
                type="time"
                required
                className={input}
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </label>
          </>
        )}
        <label className="text-sm sm:col-span-2">
          Motivo
          <input
            minLength={3}
            maxLength={300}
            className={input}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <button
          disabled={ocupado || !medicoId}
          className="rounded bg-neutral-900 p-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Registrar licencia
        </button>
      </form>
      {aviso && (
        <p role="status" className="notice">
          {aviso}
        </p>
      )}
      {!confirmacion && (error || recurso.error) && (
        <p role="alert" className="text-sm text-red-600">
          {error || recurso.error}
        </p>
      )}
      {recurso.cargando && <p>Cargando licencias…</p>}
      {recurso.data?.map((b) => (
        <article key={b.id} className="space-y-2 rounded border p-3 text-sm">
          <p>
            {b.medico.apellido}, {b.medico.nombre} · {b.fecha.slice(0, 10)} ·{" "}
            {b.horaInicio ? `${b.horaInicio}–${b.horaFin}` : "Todo el día"}
          </p>
          <p>
            {b.motivo} ·{" "}
            {(
              {
                APROBADO: "Registrada",
                PENDIENTE: "Pendiente de registrar",
                RECHAZADO: "Anulada",
              } as Record<string, string>
            )[b.estado] || b.estado}
          </p>
          {b.estado === "PENDIENTE" && (
            <div className="flex gap-4">
              <button
                disabled={ocupado}
                className="underline"
                onClick={() => resolver(b.id, "APROBADO")}
              >
                {esMedico ? "Registrar licencia" : "Registrar"}
              </button>
              <button
                disabled={ocupado}
                className="underline"
                onClick={() => resolver(b.id, "RECHAZADO")}
              >
                Rechazar
              </button>
            </div>
          )}
          {b.estado === "APROBADO" && (
            <button
              disabled={ocupado}
              className="underline"
              onClick={async () => {
                setOcupado(true);
                setError("");
                try {
                  await fetchJSON(`/api/bloqueos/${b.id}`, {
                    method: "DELETE",
                  });
                  setAviso("La licencia quedó anulada.");
                  recurso.refrescar();
                  notificarTurnos();
                } catch (e) {
                  setError(mensajeError(e));
                } finally {
                  setOcupado(false);
                }
              }}
            >
              Quitar bloqueo y habilitar horarios
            </button>
          )}
        </article>
      ))}
      {recurso.data?.length === 0 && <p>No hay licencias registradas.</p>}
      <dialog
        ref={dialogo}
        className="license-dialog"
        aria-labelledby="licencia-conflictos-titulo"
        aria-describedby="licencia-conflictos-descripcion"
        onCancel={(e) => {
          e.preventDefault();
          if (!ocupado) setConfirmacion(null);
        }}
      >
        {confirmacion && (
          <>
            <h2 id="licencia-conflictos-titulo">
              {confirmacion.conflictos.length}{" "}
              {confirmacion.conflictos.length === 1
                ? "turno coincide"
                : "turnos coinciden"}{" "}
              con la licencia
            </h2>
            <p id="licencia-conflictos-descripcion">
              Al registrar la licencia, estos turnos quedarán por reprogramar.
              Se enviará automáticamente un correo a los pacientes con email
              registrado indicando que deben reprogramar su turno, junto con el
              enlace para elegir otra fecha y horario.
            </p>
            {confirmacion.conflictos.length === 0 && (
              <p>
                La agenda cambió y ya no hay turnos coincidentes. Podés
                registrar la licencia.
              </p>
            )}
            <ol className="license-conflicts">
              {confirmacion.conflictos.map((t) => (
                <li key={t.id}>
                  <strong>
                    {t.paciente.apellido}, {t.paciente.nombre}
                  </strong>
                  <span>
                    {new Date(t.fecha + "T12:00:00Z").toLocaleDateString(
                      "es-AR",
                      { timeZone: "UTC" },
                    )}{" "}
                    · {t.horaInicio}–{t.horaFin}
                  </span>
                  {!t.tieneEmail && (
                    <p className="notice notice-error">
                      Sin email registrado. Contactá al paciente por teléfono
                      {t.paciente.telefono ? ": " + t.paciente.telefono : "."}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {error && (
              <p role="alert" className="notice notice-error">
                {error}
              </p>
            )}
            <p>¿Deseás registrar la licencia de todas maneras?</p>
            <div className="license-dialog-actions">
              <button
                type="button"
                data-cancelar
                className="btn btn-outline"
                disabled={ocupado}
                onClick={() => setConfirmacion(null)}
              >
                Volver sin registrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={ocupado}
                onClick={() =>
                  guardarLicencia(
                    confirmacion.solicitud,
                    confirmacion.conflictos,
                  )
                }
              >
                {ocupado ? "Registrando…" : "Registrar licencia y avisar"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
