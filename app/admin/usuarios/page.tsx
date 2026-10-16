import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const yo = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true },
  });
  if (!yo || yo.rol !== "ADMIN") redirect("/panel");

  const usuarios = await prisma.usuarioInterno.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <Link
          href="/admin/usuarios/nuevo"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Nuevo usuario
        </Link>
      </div>

      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {usuarios.map((u) => (
          <Link
            key={u.id}
            href={`/admin/usuarios/${u.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <span>
              {u.nombre} <span className="text-neutral-500">· {u.email}</span>
            </span>
            <span className="text-neutral-500">
              {u.rol} {!u.activo && "· inactivo"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
