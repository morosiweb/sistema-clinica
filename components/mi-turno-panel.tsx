"use client";
import { useState } from "react";
import Link from "next/link";
import { EstadoBadge } from "@/components/estado-badge";
import { ReprogramarForm } from "@/components/reprogramar-form";
import { fetchJSON, mensajeError, useAhora, useRecurso } from "@/lib/cliente";
import { instanteClinica } from "@/lib/fecha";
type Turno = {
  id: string;
  version: number;
  medicoId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  medico: {
    nombre: string;
    apellido: string;
    especialidad: { nombre: string };
  };
};
type Panel = {
  paciente: { nombre: string; apellido: string; dni: string };
  turnos: Turno[];
  hayMas: boolean;
};
export function MiTurnoPanel({ token }: { token: string }) {
  const ahora = useAhora();
  const [pagina, setPagina] = useState(1);
  const recurso = useRecurso<Panel>(
    `/api/publico/mi-turno/${token}?pagina=${pagina}`,
  );
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [reprogramando, setReprogramando] = useState("");
  const [nuevo, setNuevo] = useState("");
  async function cancelar(t: Turno) {
    if (!confirm("¿Cancelar este turno?")) return;
    setOcupado(true);
    setError("");
    try {
      await fetchJSON(`/api/publico/mi-turno/${token}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnoId: t.id, version: t.version }),
      });
      recurso.refrescar();
    } catch (e) {
      setError(mensajeError(e));
      recurso.refrescar();
    } finally {
      setOcupado(false);
    }
  }
  async function reprogramar(
    t: Turno,
    medicoId: string,
    fecha: string,
    horaInicio: string,
  ) {
    await fetchJSON(`/api/publico/mi-turno/${token}/reprogramar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turnoId: t.id,
        version: t.version,
        medicoId,
        fecha,
        horaInicio,
      }),
    });
    setReprogramando("");
    recurso.refrescar();
  }
  async function regenerar() {
    if (!confirm("El enlace actual dejará de funcionar. ¿Generar otro?"))
      return;
    setOcupado(true);
    setError("");
    try {
      const data = await fetchJSON<{ linkAcceso: string }>(
        `/api/publico/mi-turno/${token}/regenerar`,
        { method: "POST" },
      );
      setNuevo(data.linkAcceso);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  if (nuevo)
    return (
      <main className="patient-dashboard surface space-y-4 p-8">
        <h1 className="text-xl font-semibold">Nuevo enlace generado</h1>
        <p>Guardá este enlace. El anterior ya no funciona.</p>
        <Link className="break-all underline" href={nuevo}>
          {nuevo}
        </Link>
      </main>
    );
  if (recurso.cargando)
    return <p className="px-6 py-10">Cargando tus turnos…</p>;
  if (!recurso.data)
    return (
      <main className="px-6 py-10">
        <p role="alert">{recurso.error || "No se pudo cargar el enlace"}</p>
        <Link href="/mi-turno/recuperar" className="underline">
          Recuperar mi acceso
        </Link>
      </main>
    );
  const { paciente, turnos } = recurso.data;
  const futuros = turnos
    .filter(
      (t) =>
        instanteClinica(t.fecha.slice(0, 10), t.horaInicio).getTime() >= ahora,
    )
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.horaInicio.localeCompare(b.horaInicio),
    );
  const pasados = turnos.filter(
    (t) =>
      instanteClinica(t.fecha.slice(0, 10), t.horaInicio).getTime() < ahora,
  );
  return (
    <main className="patient-dashboard space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {paciente.apellido}, {paciente.nombre}
          </h1>
          <p className="text-sm">DNI {paciente.dni}</p>
        </div>
        <Link href="/reservar" className="btn btn-primary btn-small">
          Reservar otro turno
        </Link>
      </header>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <h2 className="font-semibold">Próximos turnos</h2>
      {futuros.length === 0 && (
        <p className="text-sm">No hay turnos próximos en esta página.</p>
      )}
      {futuros.map((t) => {
        const editable =
          ["PENDIENTE", "CONFIRMADO"].includes(t.estado) &&
          instanteClinica(t.fecha.slice(0, 10), t.horaInicio).getTime() -
            ahora >=
            4 * 3600000;
        return (
          <article key={t.id} className="space-y-2 rounded border p-4 text-sm">
            <p>
              {new Date(t.fecha).toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              })}{" "}
              · {t.horaInicio}–{t.horaFin}
            </p>
            <p>
              {t.medico.apellido}, {t.medico.nombre} ·{" "}
              {t.medico.especialidad.nombre}
            </p>
            <EstadoBadge estado={t.estado} />
            {editable && (
              <div className="flex gap-4">
                <button
                  disabled={ocupado}
                  className="underline"
                  onClick={() =>
                    setReprogramando(reprogramando === t.id ? "" : t.id)
                  }
                >
                  Reprogramar
                </button>
                <button
                  disabled={ocupado}
                  className="text-red-600 underline"
                  onClick={() => cancelar(t)}
                >
                  Cancelar
                </button>
              </div>
            )}
            {!editable && ["PENDIENTE", "CONFIRMADO"].includes(t.estado) && (
              <p>Para modificar este turno, comunicate con la clínica.</p>
            )}
            {reprogramando === t.id && (
              <ReprogramarForm
                key={t.id + ":" + t.version}
                medicoActualId={t.medicoId}
                onCancelar={() => setReprogramando("")}
                onConfirmar={(m, f, h) => reprogramar(t, m, f, h)}
              />
            )}
          </article>
        );
      })}
      {pasados.length > 0 && (
        <>
          <h2 className="font-semibold">Historial</h2>
          {pasados.map((t) => (
            <article key={t.id} className="rounded border p-3 text-sm">
              {t.fecha.slice(0, 10)} · {t.horaInicio} · {t.medico.apellido}{" "}
              <EstadoBadge estado={t.estado} />
            </article>
          ))}
        </>
      )}
      <nav aria-label="Páginas de turnos" className="flex gap-4 text-sm">
        <button
          disabled={pagina === 1}
          onClick={() => setPagina((p) => p - 1)}
          className="underline disabled:opacity-40"
        >
          Anterior
        </button>
        <span>Página {pagina}</span>
        <button
          disabled={!recurso.data.hayMas}
          onClick={() => setPagina((p) => p + 1)}
          className="underline disabled:opacity-40"
        >
          Siguiente
        </button>
      </nav>
      <button
        disabled={ocupado}
        onClick={regenerar}
        className="text-xs underline"
      >
        Regenerar mi enlace de acceso
      </button>
    </main>
  );
}
