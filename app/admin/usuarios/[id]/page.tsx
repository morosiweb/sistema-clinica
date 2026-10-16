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
  if (!yo || yo.rol !== "ADMIN") redirect("/");

  const { id } = await params;
  const usuario = await prisma.usuarioInterno.findUnique({ where: { id } });
  if (!usuario) notFound();

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">{usuario.nombre}</h1>
      <UsuarioForm
        usuarioId={usuario.id}
        valoresIniciales={{
          nombre: usuario.nombre,
          email: usuario.email,
          password: "",
          rol: usuario.rol,
          activo: usuario.activo,
        }}
      />
    </div>
  );
}
