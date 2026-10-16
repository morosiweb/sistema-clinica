import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { TurnoForm } from "@/components/turno-form";

export const instant = false;

export default async function NuevoTurnoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (!usuario || !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["turnos"])) {
    redirect("/");
  }

  const medicos = await prisma.medico.findMany({
    where: { activo: true },
    include: { especialidad: true },
    orderBy: { apellido: "asc" },
  });

  if (medicos.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-4 text-xl font-semibold">Nuevo turno</h1>
        <p className="text-sm text-neutral-500">
          Primero tenés que cargar al menos un médico activo en{" "}
          <a href="/medicos" className="underline">
            Médicos
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Nuevo turno</h1>
      <TurnoForm medicos={medicos} />
    </div>
  );
}
