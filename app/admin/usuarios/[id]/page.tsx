import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsuarioForm } from "@/components/usuario-form";

export const instant = false;

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const yo = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true },
  });
  if (!yo || yo.rol !== "ADMIN") redirect("/panel");

  const { id } = await params;
  const usuario = await prisma.usuarioInterno.findUnique({ where: { id } });
  if (!usuario) notFound();

  const medicosDisponibles = await prisma.medico.findMany({
    where: usuario.medicoId
      ? { OR: [{ usuarioInterno: null }, { id: usuario.medicoId }] }
      : { usuarioInterno: null },
    select: { id: true, nombre: true, apellido: true },
    orderBy: { apellido: "asc" },
  });

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">{usuario.nombre}</h1>
      <UsuarioForm
        usuarioId={usuario.id}
        medicosDisponibles={medicosDisponibles}
        valoresIniciales={{
          nombre: usuario.nombre,
          email: usuario.email,
          password: "",
          rol: usuario.rol,
          activo: usuario.activo,
          medicoId: usuario.medicoId ?? "",
        }}
      />
    </div>
  );
}
