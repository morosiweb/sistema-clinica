import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { MedicoForm } from "@/components/medico-form";

export const instant = false;

export default async function NuevoMedicoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (!usuario || !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["medicos"])) {
    redirect("/");
  }

  const especialidades = await prisma.especialidad.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  if (especialidades.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-4 text-xl font-semibold">Nuevo médico</h1>
        <p className="text-sm text-neutral-500">
          Primero tenés que cargar al menos una especialidad en{" "}
          <a href="/especialidades" className="underline">
            Especialidades
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Nuevo médico</h1>
      <MedicoForm especialidades={especialidades} />
    </div>
  );
}
