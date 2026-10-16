import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Nuevo usuario</h1>
      <UsuarioForm medicosDisponibles={medicosDisponibles} />
    </div>
  );
}
