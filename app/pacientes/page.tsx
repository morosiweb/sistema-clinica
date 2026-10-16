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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <Link
          href="/pacientes/nuevo"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Nuevo paciente
        </Link>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por DNI, nombre o apellido..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </form>

      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {pacientes.slice(0, 50).map((p) => (
          <Link
            key={p.id}
            href={`/pacientes/${p.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <span>
              {p.apellido}, {p.nombre}
            </span>
            <span className="text-neutral-500">DNI {p.dni}</span>
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
