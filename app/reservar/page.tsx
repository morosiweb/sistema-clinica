"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Clock3,
  ShieldCheck,
  Stethoscope,
  Check,
  Mail,
  ChevronRight,
} from "lucide-react";
import { sumarDias } from "@/lib/fecha";
import { fetchJSON, mensajeError, useHoy, useRecurso } from "@/lib/cliente";
type Medico = {
  id: string;
  nombre: string;
  apellido: string;
  especialidad: { id: string; nombre: string };
};
type Paso = "medico" | "horario" | "datos" | "codigo" | "confirmacion";
const input = "field-input";
const boton = "btn btn-primary";
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

  const pasos: Paso[] = ["medico", "horario", "datos", "codigo"];
  const indice = paso === "confirmacion" ? 4 : pasos.indexOf(paso);
  const titulos = [
    "Elegí a tu profesional",
    "Encontrá tu momento",
    "Contanos sobre vos",
    "Un último paso, y listo",
  ];
  const descripciones = [
    "Buscá por especialidad y seleccioná con quién querés atenderte.",
    "Consultá la disponibilidad y elegí el horario que mejor te quede.",
    "Completá tus datos para continuar con la reserva.",
    "Ingresá el código que enviamos a tu email para confirmar la reserva.",
  ];
  const fechaBonita = fecha
    ? new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : "Fecha a elegir";
  return (
    <main className="booking-page">
      <div className="booking-intro">
        <p className="eyebrow">UN MOMENTO PARA TU SALUD</p>
        <h1>
          Reservá tu turno<span className="greeting-dot">.</span>
        </h1>
        <p>Simple, seguro y sin crear una cuenta.</p>
      </div>
      <ol className="booking-steps" aria-label="Pasos de la reserva">
        {["Profesional", "Día y horario", "Tus datos", "Confirmación"].map(
          (nombre, i) => (
            <li
              key={nombre}
              className={
                i < indice
                  ? "step-complete"
                  : i === indice
                    ? "step-current"
                    : ""
              }
              aria-current={i === indice ? "step" : undefined}
            >
              <span>{i < indice ? <Check size={15} /> : i + 1}</span>
              <strong>{nombre}</strong>
            </li>
          ),
        )}
      </ol>
      <div className="booking-grid">
        <section className="booking-card" aria-live="polite">
          {paso !== "confirmacion" && (
            <div className="booking-card-heading">
              <span className="eyebrow">PASO {indice + 1} DE 4</span>
              <h2>{titulos[indice]}</h2>
              <p>{descripciones[indice]}</p>
            </div>
          )}
          {error && (
            <p role="alert" className="notice notice-error">
              {error}
            </p>
          )}
          {paso === "medico" && (
            <>
              <label className="field-label">
                Especialidad
                <select
                  className={input}
                  value={especialidad}
                  onChange={(e) => setEspecialidad(e.target.value)}
                >
                  <option value="">Todas las especialidades</option>
                  {especialidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="doctor-options">
                {medicos.cargando && (
                  <p className="loading-state" role="status">
                    Cargando médicos…
                  </p>
                )}
                {medicos.error && (
                  <p role="alert" className="notice notice-error">
                    {medicos.error}
                  </p>
                )}
                {(medicos.data || [])
                  .filter(
                    (m) => !especialidad || m.especialidad.id === especialidad,
                  )
                  .map((m) => (
                    <button
                      key={m.id}
                      className="doctor-option"
                      onClick={() => {
                        setMedico(m);
                        setHora("");
                        setError("");
                        setPaso("horario");
                      }}
                    >
                      <span className="doctor-avatar">
                        {m.nombre[0]}
                        {m.apellido[0]}
                      </span>
                      <span>
                        <strong>
                          {m.apellido}, {m.nombre}
                        </strong>
                        <small>{m.especialidad.nombre}</small>
                      </span>
                      <ChevronRight size={20} />
                    </button>
                  ))}
                {medicos.data?.length === 0 && (
                  <div className="empty-state">
                    <Stethoscope size={28} />
                    <p>No hay médicos disponibles por el momento.</p>
                  </div>
                )}
              </div>
            </>
          )}
          {paso === "horario" && medico && (
            <>
              <button
                className="text-link mb-5"
                onClick={() => setPaso("medico")}
              >
                <ArrowLeft size={15} />
                Cambiar médico
              </button>
              <label className="field-label">
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
              <div className="date-options">
                {hoy &&
                  Array.from({ length: 5 }, (_, i) => sumarDias(hoy, i)).map(
                    (d) => (
                      <button
                        key={d}
                        aria-pressed={fecha === d}
                        className={fecha === d ? "date-active" : ""}
                        onClick={() => {
                          setDia(d);
                          setHora("");
                        }}
                      >
                        <small>
                          {new Date(`${d}T12:00:00Z`).toLocaleDateString(
                            "es-AR",
                            { weekday: "short", timeZone: "UTC" },
                          )}
                        </small>
                        <strong>{Number(d.slice(8))}</strong>
                      </button>
                    ),
                  )}
              </div>
              <div className="slots-heading">
                <Clock3 size={17} />
                <h3>Horarios disponibles</h3>
                <span>Hora de la clínica</span>
              </div>
              {disponibilidad.cargando ? (
                <p className="loading-state" role="status">
                  Cargando horarios…
                </p>
              ) : disponibilidad.error ? (
                <p role="alert" className="notice notice-error">
                  {disponibilidad.error}
                </p>
              ) : (
                <div className="slot-grid">
                  {disponibilidad.data?.slots.map((h) => (
                    <button
                      key={h}
                      className="time-slot"
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
                <div className="empty-state">
                  <CalendarDays size={28} />
                  <h3>No hay horarios ese día</h3>
                  <p>Probá con otra fecha para encontrar tu turno.</p>
                </div>
              )}
            </>
          )}
          {paso === "datos" && (
            <form onSubmit={pedirCodigo} className="space-y-5">
              <button
                type="button"
                className="text-link"
                onClick={() => setPaso("horario")}
              >
                <ArrowLeft size={15} />
                Cambiar fecha u horario
              </button>
              <div className="form-grid">
                {(
                  [
                    ["dni", "DNI"],
                    ["nombre", "Nombre"],
                    ["apellido", "Apellido"],
                    ["telefono", "Teléfono"],
                    ["email", "Email"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className={`field-label ${key === "email" ? "field-full" : ""}`}
                  >
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
                      autoComplete={
                        {
                          nombre: "given-name",
                          apellido: "family-name",
                          telefono: "tel",
                          email: "email",
                          dni: "off",
                        }[key]
                      }
                      value={datos[key]}
                      onChange={(e) => cambiarDato(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label className="field-label">
                Motivo de consulta <span className="optional">(opcional)</span>
                <textarea
                  className={input}
                  rows={3}
                  maxLength={300}
                  value={datos.motivoConsulta}
                  onChange={(e) =>
                    cambiarDato("motivoConsulta", e.target.value)
                  }
                />
              </label>
              <p className="notice notice-info">
                <ShieldCheck size={18} />
                Si ya sos paciente, enviamos el código al email registrado en la
                clínica. Para actualizarlo, comunicate con secretaría.
              </p>
              <button className={boton} disabled={enviando}>
                {enviando ? "Enviando…" : "Recibir código"}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {paso === "codigo" && (
            <form onSubmit={reservar} className="space-y-5">
              <span className="verification-icon">
                <Mail size={27} />
              </span>
              <p className="muted">
                Revisá tu email registrado. El código vence en 10 minutos. Tu
                horario se confirma al completar este paso.
              </p>
              <label className="field-label">
                Código de seis dígitos
                <input
                  className="field-input otp-input"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </label>
              <button
                className={boton}
                disabled={enviando || codigo.length !== 6}
              >
                {enviando ? "Confirmando…" : "Confirmar reserva"}
                <Check size={17} />
              </button>
              <div className="booking-secondary-actions">
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => setPaso("horario")}
                >
                  Cambiar horario
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => pedirCodigo()}
                >
                  Solicitar otro código
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => setPaso("datos")}
                >
                  Revisar mis datos
                </button>
              </div>
              <p className="help-text">
                Si no recibís el código o no tenés acceso a tu email, comunicate
                con secretaría.
              </p>
            </form>
          )}
          {paso === "confirmacion" && resultado && (
            <div className="booking-success">
              <span className="success-icon">
                <Check size={32} />
              </span>
              <p className="eyebrow">YA TENÉS TU PRÓXIMA VISITA</p>
              <h2>¡Turno reservado!</h2>
              <p>
                {resultado.correoEnviado
                  ? "Enviamos la confirmación y tu enlace de gestión por email."
                  : "El turno quedó reservado, pero no pudimos enviar la confirmación por email. Guardá este enlace."}
              </p>
              <Link className="btn btn-primary" href={resultado.linkAcceso}>
                Ver y gestionar mis turnos <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </section>
        <aside className="booking-aside">
          <div className="booking-summary">
            <div className="summary-title">
              <CalendarDays size={20} />
              <h2>Tu próxima visita</h2>
            </div>
            {medico ? (
              <>
                <div className="summary-doctor">
                  <span className="doctor-avatar">
                    {medico.nombre[0]}
                    {medico.apellido[0]}
                  </span>
                  <div>
                    <strong>
                      {medico.apellido}, {medico.nombre}
                    </strong>
                    <span>{medico.especialidad.nombre}</span>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>
                      <CalendarDays size={16} />
                      Fecha
                    </dt>
                    <dd>{paso === "medico" ? "A elegir" : fechaBonita}</dd>
                  </div>
                  <div>
                    <dt>
                      <Clock3 size={16} />
                      Horario
                    </dt>
                    <dd>{hora ? `${hora} h` : "A elegir"}</dd>
                  </div>
                </dl>
                <span className="summary-status">
                  <span />
                  {paso === "confirmacion"
                    ? "Reserva realizada"
                    : "Reserva en curso"}
                </span>
              </>
            ) : (
              <div className="summary-placeholder">
                <Stethoscope size={35} strokeWidth={1.2} />
                <p>Tu turno empieza acá.</p>
                <span>
                  Elegí a tu profesional para ver el resumen de tu visita.
                </span>
              </div>
            )}
          </div>
          <div className="booking-help">
            <ShieldCheck size={20} />
            <div>
              <strong>Tu información, cuidada.</strong>
              <p>
                Verificamos tu identidad con un código por email, sin cuentas ni
                contraseñas.
              </p>
            </div>
          </div>
          <Link className="text-link" href="/mi-turno/recuperar">
            Ya tengo un turno <ArrowUpRightIcon />
          </Link>
        </aside>
      </div>
    </main>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
