import { PageHeading } from "@/components/page-heading";
import { Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { paginaSchema } from "@/lib/validations/comun";
import { pacienteSelectSeguro } from "@/lib/pacientes";

export const instant = false;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["pacientes"])
  ) {
    redirect("/panel");
  }

  const { q, pagina: paginaParam } = await searchParams;
  const pagina = paginaSchema.safeParse(paginaParam).data || 1;
  const pacientes = await prisma.paciente.findMany({
    where: q
      ? {
          OR: [
            { dni: { contains: q } },
            { nombre: { contains: q, mode: "insensitive" } },
            { apellido: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: pacienteSelectSeguro,
    orderBy: { apellido: "asc" },
    take: 51,
    skip: (pagina - 1) * 50,
  });

  return (
    <div className="record-page">
      <PageHeading
        title="Pacientes"
        description="Un lugar para cada paciente y su información de contacto."
        action={{ href: "/pacientes/nuevo", label: "Nuevo paciente" }}
      />

      <form className="patient-search" role="search">
        <label htmlFor="buscar-paciente" className="sr-only">
          Buscar pacientes
        </label>
        <input
          id="buscar-paciente"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por DNI, nombre o apellido..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
        <button type="submit" className="btn btn-primary btn-small">
          <Search size={16} />
          Buscar
        </button>
      </form>

      <div className="directory surface">
        <div className="directory-heading">
          <span>Paciente</span>
          <span>Documento</span>
          <span>Contacto</span>
          <span />
        </div>
        {pacientes.slice(0, 50).map((p) => (
          <Link
            key={p.id}
            href={`/pacientes/${p.id}`}
            className="directory-row"
          >
            <span className="directory-person">
              <span className="patient-avatar">
                {p.nombre[0]}
                {p.apellido[0]}
              </span>
              <strong>
                {p.apellido}, {p.nombre}
              </strong>
            </span>
            <span className="directory-document">DNI {p.dni}</span>
            <span className="directory-contact">
              {p.email || p.telefono || "Sin contacto registrado"}
            </span>
            <span className="directory-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        ))}
        {pacientes.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">
            No se encontraron pacientes.
          </p>
        )}
      </div>
      <nav
        aria-label="Páginas de pacientes"
        className="mt-4 flex gap-4 text-sm"
      >
        {pagina > 1 && (
          <Link
            className="underline"
            href={`/pacientes?${new URLSearchParams({ q: q || "", pagina: String(pagina - 1) })}`}
          >
            Anterior
          </Link>
        )}
        <span>Página {pagina}</span>
        {pacientes.length > 50 && (
          <Link
            className="underline"
            href={`/pacientes?${new URLSearchParams({ q: q || "", pagina: String(pagina + 1) })}`}
          >
            Siguiente
          </Link>
        )}
      </nav>
    </div>
  );
}
