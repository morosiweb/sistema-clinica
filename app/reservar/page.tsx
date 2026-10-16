"use client";

import { useEffect, useState } from "react";

type Especialidad = { id: string; nombre: string };
type Medico = { id: string; nombre: string; apellido: string; especialidad: { nombre: string } };

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

export default function ReservarPage() {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [especialidadId, setEspecialidadId] = useState("");
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicoId, setMedicoId] = useState("");
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
      .then((ms: Medico[]) => {
        setMedicos(ms);
        setMedicoId(ms[0]?.id ?? "");
      });
  }, [especialidadId]);

  useEffect(() => {
    if (!medicoId || !fecha) return;
    setHoraInicio("");
    fetch(`/api/publico/disponibilidad?medicoId=${medicoId}&fecha=${fecha}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []));
  }, [medicoId, fecha]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!medicoId || !horaInicio) {
      setError("Elegí médico, fecha y horario.");
      return;
    }
    setEnviando(true);
    const res = await fetch("/api/publico/reservar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicoId,
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
  }

  if (linkAcceso) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="mb-4 text-xl font-semibold">¡Turno reservado!</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Guardá este link: te sirve siempre para ver, cancelar o reprogramar tus turnos, sin
          necesidad de usuario ni contraseña.
        </p>
        <a
          href={linkAcceso}
          className="block break-all rounded-md border border-neutral-200 p-4 text-sm underline dark:border-neutral-800"
        >
          {typeof window !== "undefined" ? window.location.origin : ""}
          {linkAcceso}
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-2 text-xl font-semibold">Reservar turno</h1>
      <p className="mb-6 text-sm text-neutral-500">
        ¿Ya reservaste antes?{" "}
        <a href="/mi-turno/recuperar" className="underline">
          Recuperar mi acceso
        </a>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Especialidad</label>
          <select className={inputClass} value={especialidadId} onChange={(e) => setEspecialidadId(e.target.value)}>
            <option value="">Todas</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Médico *</label>
          <select className={inputClass} value={medicoId} onChange={(e) => setMedicoId(e.target.value)}>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.apellido}, {m.nombre} · {m.especialidad.nombre}
              </option>
            ))}
          </select>
          {medicos.length === 0 && <p className="text-xs text-neutral-500">No hay médicos disponibles.</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha *</label>
            <input
              type="date"
              className={inputClass}
              value={fecha}
              min={hoy}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Horario *</label>
            <select className={inputClass} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}>
              <option value="">— Elegir —</option>
              {slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {slots.length === 0 && (
          <p className="text-xs text-neutral-500">No hay horarios disponibles ese día.</p>
        )}

        <hr className="border-neutral-200 dark:border-neutral-800" />

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
            <input required className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} />
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
          <label className="text-sm font-medium">Email (opcional)</label>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Motivo de consulta</label>
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
    </div>
  );
}
