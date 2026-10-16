"use client";
import { useState } from "react";
import Link from "next/link";
import { fetchJSON, mensajeError, useHoy, useRecurso } from "@/lib/cliente";
type Medico = {
  id: string;
  nombre: string;
  apellido: string;
  especialidad: { id: string; nombre: string };
};
type Paso = "medico" | "horario" | "datos" | "codigo" | "confirmacion";
const input =
  "mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const boton =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900";
export default function ReservarPage() {
  const hoy = useHoy();
  const [paso, setPaso] = useState<Paso>("medico");
  const [especialidad, setEspecialidad] = useState("");
  const [medico, setMedico] = useState<Medico | null>(null);
  const [dia, setDia] = useState("");
  const fecha = dia || hoy;
  const [hora, setHora] = useState("");
  const [datos, setDatos] = useState({
    dni: "",
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    motivoConsulta: "",
  });
  const [verificacionId, setVerificacion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{
    linkAcceso: string;
    correoEnviado: boolean;
  }>();
  const medicos = useRecurso<Medico[]>("/api/publico/medicos");
  const disponibilidad = useRecurso<{ slots: string[] }>(
    medico && fecha
      ? `/api/publico/disponibilidad?${new URLSearchParams({ medicoId: medico.id, fecha })}`
      : null,
  );
  const especialidades = [
    ...new Map(
      (medicos.data || []).map((m) => [m.especialidad.id, m.especialidad]),
    ).values(),
  ];
  function cambiarDato(key: keyof typeof datos, valor: string) {
    setDatos((d) => ({ ...d, [key]: valor }));
    setVerificacion("");
    setCodigo("");
  }
  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const res = await fetchJSON<{ verificacionId: string }>(
        "/api/publico/verificacion",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dni: datos.dni, email: datos.email }),
        },
      );
      setVerificacion(res.verificacionId);
      setCodigo("");
      setPaso("codigo");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }
  async function reservar(e: React.FormEvent) {
    e.preventDefault();
    if (!medico || !hora || !fecha) return;
    setError("");
    setEnviando(true);
    try {
      const res = await fetchJSON<{
        linkAcceso: string;
        correoEnviado: boolean;
      }>("/api/publico/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...datos,
          medicoId: medico.id,
          fecha,
          horaInicio: hora,
          verificacionId,
          codigo,
        }),
      });
      setResultado(res);
      setPaso("confirmacion");
    } catch (e) {
      setError(mensajeError(e));
      disponibilidad.refrescar();
    } finally {
      setEnviando(false);
    }
  }
  return (
    <main className="mx-auto max-w-xl space-y-5 px-6 py-10">
      <Link href="/" className="text-sm underline">
        Inicio
      </Link>
      <h1 className="text-2xl font-semibold">Reservá tu turno</h1>
      <p className="text-sm text-neutral-500">
        Sin cuentas ni contraseñas. Verificamos tu acceso con un código por
        email.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {paso === "medico" && (
        <>
          <label className="block text-sm">
            Especialidad
            <select
              className={input}
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
            >
              <option value="">Todas</option>
              {especialidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          {medicos.cargando && <p>Cargando médicos…</p>}
          {medicos.error && <p role="alert">{medicos.error}</p>}
          {(medicos.data || [])
            .filter((m) => !especialidad || m.especialidad.id === especialidad)
            .map((m) => (
              <button
                key={m.id}
                className="block w-full rounded border p-3 text-left text-sm"
                onClick={() => {
                  setMedico(m);
                  setHora("");
                  setError("");
                  setPaso("horario");
                }}
              >
                {m.apellido}, {m.nombre} · {m.especialidad.nombre}
              </button>
            ))}
          {medicos.data?.length === 0 && <p>No hay médicos disponibles.</p>}
        </>
      )}
      {paso === "horario" && medico && (
        <>
          <p>
            {medico.apellido}, {medico.nombre} · {medico.especialidad.nombre}
          </p>
          <button
            className="text-sm underline"
            onClick={() => setPaso("medico")}
          >
            Cambiar médico
          </button>
          <label className="block text-sm">
            Fecha
            <input
              type="date"
              min={hoy}
              required
              className={input}
              value={fecha}
              onChange={(e) => {
                setDia(e.target.value);
                setHora("");
              }}
            />
          </label>
          {disponibilidad.cargando ? (
            <p>Cargando horarios…</p>
          ) : disponibilidad.error ? (
            <p role="alert">{disponibilidad.error}</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {disponibilidad.data?.slots.map((h) => (
                <button
                  key={h}
                  className="rounded border p-2 text-sm"
                  onClick={() => {
                    setHora(h);
                    setPaso(verificacionId ? "codigo" : "datos");
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
          {disponibilidad.data?.slots.length === 0 && (
            <p>No hay horarios disponibles ese día.</p>
          )}
        </>
      )}
      {paso === "datos" && (
        <form onSubmit={pedirCodigo} className="space-y-4">
          <p className="text-sm">
            {medico?.apellido} · {fecha} · {hora}
          </p>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setPaso("horario")}
          >
            Cambiar fecha u horario
          </button>
          {(
            [
              ["dni", "DNI"],
              ["nombre", "Nombre"],
              ["apellido", "Apellido"],
              ["telefono", "Teléfono"],
              ["email", "Email"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                className={input}
                required
                type={
                  key === "email"
                    ? "email"
                    : key === "telefono"
                      ? "tel"
                      : "text"
                }
                inputMode={key === "dni" ? "numeric" : undefined}
                autoComplete={key === "email" ? "email" : undefined}
                value={datos[key]}
                onChange={(e) => cambiarDato(key, e.target.value)}
              />
            </label>
          ))}
          <label className="block text-sm">
            Motivo de consulta (opcional)
            <textarea
              className={input}
              maxLength={300}
              value={datos.motivoConsulta}
              onChange={(e) => cambiarDato("motivoConsulta", e.target.value)}
            />
          </label>
          <p className="text-sm text-neutral-500">
            Si ya sos paciente, enviamos el código al email que tiene registrado
            la clínica. Para actualizarlo, comunicate con secretaría.
          </p>
          <button className={boton} disabled={enviando}>
            {enviando ? "Enviando…" : "Recibir código"}
          </button>
        </form>
      )}
      {paso === "codigo" && (
        <form onSubmit={reservar} className="space-y-4">
          <p className="text-sm">
            Revisá tu email registrado. El código vence en 10 minutos; el
            horario se confirma al completar este paso.
          </p>
          <p className="text-sm">
            {medico?.apellido} · {fecha} · {hora}
          </p>
          <label className="block text-sm">
            Código de seis dígitos
            <input
              className={input}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </label>
          <button className={boton} disabled={enviando || codigo.length !== 6}>
            {enviando ? "Confirmando…" : "Confirmar reserva"}
          </button>
          <div className="flex flex-wrap gap-4 text-sm">
            <button
              type="button"
              disabled={enviando}
              onClick={() => setPaso("horario")}
              className="underline"
            >
              Cambiar horario
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => pedirCodigo()}
              className="underline"
            >
              Solicitar otro código
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => setPaso("datos")}
              className="underline"
            >
              Revisar mis datos
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Si no recibís el código o no tenés acceso a tu email, comunicate con
            secretaría.
          </p>
        </form>
      )}
      {paso === "confirmacion" && resultado && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">¡Turno reservado!</h2>
          <p className="text-sm">
            {resultado.correoEnviado
              ? "Enviamos la confirmación y tu enlace de gestión por email."
              : "El turno quedó reservado, pero no pudimos enviar la confirmación por email. Guardá este enlace."}
          </p>
          <Link
            className="block break-all rounded border p-4 text-sm underline"
            href={resultado.linkAcceso}
          >
            Ver y gestionar mis turnos
          </Link>
        </div>
      )}
      <p className="text-sm">
        <Link href="/mi-turno/recuperar" className="underline">
          Ya tengo un turno: recuperar mi acceso
        </Link>
      </p>
    </main>
  );
}
