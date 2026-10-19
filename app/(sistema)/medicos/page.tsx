import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";

export const instant = false;

export default async function MedicosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["medicos"])
  ) {
    redirect("/panel");
  }

  const medicos = await prisma.medico.findMany({
    include: {
      especialidad: true,
      usuarioInterno: { select: { activo: true } },
    },
    orderBy: { apellido: "asc" },
  });

  return (
    <div className="record-page">
      <PageHeading
        title="Médicos"
        description="El equipo profesional, sus agendas y accesos al panel."
        action={{ href: "/medicos/nuevo", label: "Nuevo médico" }}
      />

      <div className="professional-grid">
        {medicos.map((m) => (
          <Link
            key={m.id}
            href={`/medicos/${m.id}`}
            className="professional-card"
            style={{ borderTop: `4px solid ${m.color}` }}
          >
            <span className="doctor-avatar" aria-hidden="true">
              {m.nombre[0]}
              {m.apellido[0]}
            </span>
            <span className="professional-name">
              <strong>
                {m.apellido}, {m.nombre}
              </strong>
              <span>
                {m.especialidad.nombre} · {m.duracionTurnoMinutos} min por
                consulta
              </span>
            </span>
            <span
              className={`professional-status ${m.activo ? "" : "professional-inactive"}`}
            >
              {m.activo ? "Activo" : "Inactivo"}
            </span>
            <span className="professional-card-footer">
              {m.usuarioInterno
                ? m.usuarioInterno.activo
                  ? "Acceso al panel activo"
                  : "Acceso al panel inactivo"
                : "Sin acceso al panel"}{" "}
              <span>Ver perfil y acceso ↗</span>
            </span>
          </Link>
        ))}
        {medicos.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">
            No hay médicos cargados.
          </p>
        )}
      </div>
    </div>
  );
}
