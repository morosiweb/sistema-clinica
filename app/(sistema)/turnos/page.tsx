import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { CalendarioTurnos } from "@/components/calendario-turnos";
import { EstadoBadge } from "@/components/estado-badge";

export const instant = false;

export default async function TurnosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["turnos"])
  ) {
    redirect("/panel");
  }

  const ultimos = await prisma.turno.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      paciente: { select: { nombre: true, apellido: true } },
      medico: true,
    },
  });

  return (
    <div className="record-page">
      <PageHeading
        title="Turnos"
        description="Organizá la agenda y acompañá cada consulta."
        action={{ href: "/turnos/nuevo", label: "Nuevo turno" }}
      />

      {ultimos.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium text-neutral-500">
            Últimos turnos reservados
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ultimos.map((t) => (
              <Link
                key={t.id}
                href={`/turnos/${t.id}`}
                className="shrink-0 rounded-md border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <p className="font-medium">
                  {t.paciente.apellido}, {t.paciente.nombre}
                </p>
                <p className="text-neutral-500">
                  {new Date(t.fecha).toLocaleDateString("es-AR", {
                    timeZone: "UTC",
                  })}{" "}
                  · {t.horaInicio} · {t.medico.apellido}
                </p>
                <EstadoBadge estado={t.estado} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <CalendarioTurnos mostrarFiltroMedicos />
    </div>
  );
}
