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
    include: { especialidad: true },
    orderBy: { apellido: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Médicos</h1>
        <Link
          href="/medicos/nuevo"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Nuevo médico
        </Link>
      </div>

      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {medicos.map((m) => (
          <Link
            key={m.id}
            href={`/medicos/${m.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <span>
              {m.apellido}, {m.nombre}{" "}
              <span className="text-neutral-500">
                · {m.especialidad.nombre}
              </span>
            </span>
            {!m.activo && <span className="text-neutral-500">inactivo</span>}
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
