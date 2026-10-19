import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ArrowUpRight,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, pantallasPermitidas } from "@/lib/pantallas";
import { fechaClinica, fechaDB } from "@/lib/fecha";
import { EstadoBadge } from "@/components/estado-badge";
export const instant = false;
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/sesion-invalida");
  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: {
      nombre: true,
      rol: true,
      permisos: true,
      activo: true,
      medicoId: true,
    },
  });
  if (!usuario?.activo) redirect("/api/auth/sesion-invalida");
  const pantallas = pantallasPermitidas(
    parsePermisos(usuario.permisos),
    usuario.rol,
  );
  const puedeAgenda = pantallas.some(
    (p) => p.key === "turnos" || p.key === "agenda",
  );
  const medico = usuario.rol === "MEDICO";
  const hoy = fechaClinica();
  const turnos =
    puedeAgenda && (!medico || usuario.medicoId)
      ? await prisma.turno.findMany({
          where: {
            fecha: fechaDB(hoy),
            ...(medico ? { medicoId: usuario.medicoId! } : {}),
          },
          select: {
            id: true,
            horaInicio: true,
            horaFin: true,
            estado: true,
            paciente: { select: { nombre: true, apellido: true } },
            medico: {
              select: {
                nombre: true,
                apellido: true,
                especialidad: { select: { nombre: true } },
              },
            },
          },
          orderBy: { horaInicio: "asc" },
        })
      : [];
  const activos = turnos.filter((t) => t.estado !== "CANCELADO");
  const fecha = new Date(`${hoy}T12:00:00Z`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">TU DÍA, EN UN VISTAZO</p>
          <h1>
            Hola, {usuario.nombre.split(" ")[0]}
            <span className="greeting-dot">.</span>
          </h1>
          <p>Todo listo para acompañar una nueva jornada de atención.</p>
        </div>
        <div className="dashboard-date">
          <CalendarDays size={18} />
          <span>{fecha}</span>
        </div>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="welcome-tag">
            {medico ? "TU CONSULTORIO, CONECTADO" : "CADA DETALLE CUENTA"}
          </span>
          <h2>
            {medico
              ? "Más foco en tus pacientes."
              : "Una atención que empieza en el orden."}
          </h2>
          <p>
            {medico
              ? "Tu agenda y la información de cada consulta, en un mismo espacio."
              : "Gestioná la agenda y acompañá a cada paciente desde su primera consulta."}
          </p>
          {pantallas.some((p) => p.key === "turnos") ? (
            <Link href="/turnos/nuevo" className="btn btn-white btn-small">
              Nuevo turno <ArrowUpRight size={17} />
            </Link>
          ) : (
            pantallas.some((p) => p.key === "agenda") && (
              <Link href="/agenda" className="btn btn-white btn-small">
                Abrir mi agenda <ArrowUpRight size={17} />
              </Link>
            )
          )}
        </div>
        <div className="welcome-graphic" aria-hidden="true">
          <Stethoscope size={110} strokeWidth={1} />
          <span>+</span>
        </div>
      </section>
      <div className="dashboard-columns">
        <section className="surface">
          <div className="surface-heading">
            <div>
              <h2>Agenda de hoy</h2>
              <p>
                {medico
                  ? "Tus consultas de la jornada"
                  : "La actividad de la clínica"}
              </p>
            </div>
            {puedeAgenda && (
              <Link href={medico ? "/agenda" : "/turnos"} className="text-link">
                Ver agenda <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
          {!puedeAgenda ? (
            <div className="empty-state">
              <Stethoscope size={30} />
              <h3>Tu espacio está listo</h3>
              <p>Usá los accesos habilitados para continuar.</p>
            </div>
          ) : activos.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={30} strokeWidth={1.4} />
              <h3>Un día con espacio por delante</h3>
              <p>No hay turnos programados para hoy.</p>
            </div>
          ) : (
            <div className="appointment-list">
              {activos.slice(0, 8).map((t) => (
                <Link
                  href={`/turnos/${t.id}`}
                  className="appointment-row"
                  key={t.id}
                >
                  <span className="appointment-time">
                    {t.horaInicio}
                    <small>{t.horaFin}</small>
                  </span>
                  <span className="patient-avatar">
                    {t.paciente.nombre[0]}
                    {t.paciente.apellido[0]}
                  </span>
                  <span className="appointment-person">
                    <strong>
                      {t.paciente.apellido}, {t.paciente.nombre}
                    </strong>
                    <small>
                      {t.medico.apellido} · {t.medico.especialidad.nombre}
                    </small>
                  </span>
                  <EstadoBadge estado={t.estado} />
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <div className="dashboard-side">
          {puedeAgenda && (
            <div className="metric-grid">
              {[
                {
                  label: "Turnos de hoy",
                  value: activos.length,
                  icon: CalendarDays,
                  caption: "Consultas en la jornada",
                  color: "teal",
                },
              ].map(({ label, value, icon: Icon, caption, color }) => (
                <article className="metric-card" key={label}>
                  <div>
                    <span>{label}</span>
                    <span className={`metric-icon ${color}`}>
                      <Icon size={21} />
                    </span>
                  </div>
                  <strong>{value.toString().padStart(2, "0")}</strong>
                  <p>{caption}</p>
                </article>
              ))}
            </div>
          )}
          <section className="surface quick-access">
            <div className="surface-heading">
              <div>
                <h2>Accesos rápidos</h2>
                <p>Lo que necesitás, más cerca</p>
              </div>
            </div>
            {pantallas.map((p) => (
              <Link key={p.key} href={p.href}>
                <span>{p.label}</span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
            {pantallas.length === 0 && (
              <p className="p-6 text-sm text-neutral-500">
                No tenés pantallas habilitadas todavía.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
