import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
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
    <div className="record-page">
      <PageHeading
        title="Usuarios"
        description="Gestioná el equipo, sus accesos y permisos."
        action={{ href: "/admin/usuarios/nuevo", label: "Nuevo usuario" }}
      />

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
