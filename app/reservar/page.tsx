"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Especialidad = { id: string; nombre: string };
type Medico = { id: string; nombre: string; apellido: string; especialidad: { nombre: string } };
type Paso = "medico" | "horario" | "datos" | "confirmacion";

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

const PASOS: { id: Paso; label: string }[] = [
  { id: "medico", label: "Médico" },
  { id: "horario", label: "Fecha y hora" },
  { id: "datos", label: "Tus datos" },
];

export default function ReservarPage() {
  const [paso, setPaso] = useState<Paso>("medico");

  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [especialidadId, setEspecialidadId] = useState("");
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicoElegido, setMedicoElegido] = useState<Medico | null>(null);

  const [hoy, setHoy] = useState("");
  const [fecha, setFecha] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState("");

  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [motivoConsulta, setMotivoConsulta] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [linkAcceso, setLinkAcceso] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date().toISOString().slice(0, 10);
    setHoy(d);
    setFecha(d);
  }, []);

  useEffect(() => {
    fetch("/api/publico/especialidades")
      .then((r) => r.json())
      .then(setEspecialidades);
  }, []);

  useEffect(() => {
    const url = especialidadId
      ? `/api/publico/medicos?especialidadId=${especialidadId}`
      : "/api/publico/medicos";
    fetch(url)
      .then((r) => r.json())
      .then(setMedicos);
  }, [especialidadId]);

  useEffect(() => {
    if (!medicoElegido || !fecha) return;
    setHoraInicio("");
    fetch(`/api/publico/disponibilidad?medicoId=${medicoElegido.id}&fecha=${fecha}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []));
  }, [medicoElegido, fecha]);

  function elegirMedico(m: Medico) {
    setMedicoElegido(m);
    setPaso("horario");
  }

  function elegirHorario(h: string) {
    setHoraInicio(h);
    setPaso("datos");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!medicoElegido || !horaInicio) {
      setError("Elegí médico, fecha y horario.");
      return;
    }
    setEnviando(true);
    const res = await fetch("/api/publico/reservar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicoId: medicoElegido.id,
        fecha,
        horaInicio,
        dni,
        nombre,
        apellido,
        telefono,
        email,
        motivoConsulta,
      }),
    });
    setEnviando(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error && typeof data.error === "string" ? data.error : "No se pudo reservar.");
      return;
    }
    setLinkAcceso(data.linkAcceso);
    setPaso("confirmacion");
  }

  if (paso === "confirmacion" && linkAcceso) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-4 text-xl font-semibold">¡Turno reservado!</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Te mandamos un mail con la confirmación. Guardá el link de ahí: te sirve siempre para ver,
          cancelar o reprogramar tus turnos, sin necesidad de usuario ni contraseña.
        </p>
        <a
          href={linkAcceso}
          className="block w-full break-all rounded-md border border-neutral-200 p-4 text-sm underline dark:border-neutral-800"
        >
          {typeof window !== "undefined" ? window.location.origin : ""}
          {linkAcceso}
        </a>
        <Link href="/" className="mt-6 text-sm text-neutral-500 underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-8 flex items-center justify-center gap-2">
        {PASOS.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                p.id === paso
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
              }`}
            >
              {i + 1}
            </span>
            <span className="text-sm text-neutral-500">{p.label}</span>
            {i < PASOS.length - 1 && <span className="mx-1 text-neutral-300">—</span>}
          </div>
        ))}
      </div>

      {paso === "medico" && (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">¿Con quién querés atenderte?</h1>

          {especialidades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setEspecialidadId("")}
                className={`rounded-full border px-3 py-1 text-xs ${
                  especialidadId === ""
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                Todas
              </button>
              {especialidades.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEspecialidadId(e.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    especialidadId === e.id
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  {e.nombre}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {medicos.map((m) => (
              <button
                key={m.id}
                onClick={() => elegirMedico(m)}
                className="flex w-full items-center justify-between rounded-md border border-neutral-200 px-4 py-3 text-left text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <span className="font-medium">
                  {m.apellido}, {m.nombre}
                </span>
                <span className="text-neutral-500">{m.especialidad.nombre}</span>
              </button>
            ))}
            {medicos.length === 0 && (
              <p className="text-sm text-neutral-500">No hay médicos disponibles.</p>
            )}
          </div>
        </div>
      )}

      {paso === "horario" && medicoElegido && (
        <div className="space-y-4">
          <button onClick={() => setPaso("medico")} className="text-sm text-neutral-500 underline">
            ← Cambiar médico
          </button>
          <h1 className="text-xl font-semibold">
            {medicoElegido.apellido}, {medicoElegido.nombre}
          </h1>
          <p className="text-sm text-neutral-500">{medicoElegido.especialidad.nombre}</p>

          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha</label>
            <input
              type="date"
              className={inputClass}
              value={fecha}
              min={hoy}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Horarios disponibles</label>
            {slots.length === 0 ? (
              <p className="text-sm text-neutral-500">No hay horarios disponibles ese día.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => elegirHorario(s)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {paso === "datos" && medicoElegido && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <button type="button" onClick={() => setPaso("horario")} className="text-sm text-neutral-500 underline">
            ← Cambiar fecha u horario
          </button>
          <h1 className="text-xl font-semibold">Tus datos</h1>
          <p className="text-sm text-neutral-500">
            {medicoElegido.apellido}, {medicoElegido.nombre} ·{" "}
            {new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR", { dateStyle: "long" })} · {horaInicio}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">DNI *</label>
              <input required className={inputClass} value={dni} onChange={(e) => setDni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Teléfono *</label>
              <input
                required
                className={inputClass}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre *</label>
              <input
                required
                className={inputClass}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Apellido *</label>
              <input
                required
                className={inputClass}
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Email *</label>
            <input
              required
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-neutral-500">Te mandamos ahí la confirmación y tu link de acceso.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Breve descripción del problema (opcional)</label>
            <input
              className={inputClass}
              value={motivoConsulta}
              onChange={(e) => setMotivoConsulta(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {enviando ? "Reservando..." : "Confirmar turno"}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-neutral-500">
        ¿Ya reservaste antes?{" "}
        <Link href="/mi-turno/recuperar" className="underline">
          Recuperar mi acceso
        </Link>
      </p>
    </div>
  );
}
