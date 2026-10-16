import { PageHeading } from "@/components/page-heading";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { UsuarioForm } from "@/components/usuario-form";

export const instant = false;

export default async function NuevoUsuarioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const yo = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true },
  });
  if (!yo || yo.rol !== "ADMIN") redirect("/panel");

  const medicosDisponibles = await prisma.medico.findMany({
    where: { usuarioInterno: null },
    select: { id: true, nombre: true, apellido: true },
    orderBy: { apellido: "asc" },
  });

  return (
    <div className="record-page">
      <PageHeading
        title="Nuevo usuario"
        description="Creá un acceso y asigná los permisos del equipo."
      />
      <UsuarioForm medicosDisponibles={medicosDisponibles} />
    </div>
  );
}
