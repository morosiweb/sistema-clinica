import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { EspecialidadManager } from "@/components/especialidad-manager";

export const instant = false;

export default async function EspecialidadesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (!usuario || !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["especialidades"])) {
    redirect("/panel");
  }

  const especialidades = await prisma.especialidad.findMany({ orderBy: { nombre: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Especialidades</h1>
      <EspecialidadManager especialidades={especialidades} />
    </div>
  );
}
