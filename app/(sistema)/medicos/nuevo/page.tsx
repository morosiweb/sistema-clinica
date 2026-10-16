import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
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
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["medicos"])
  ) {
    redirect("/panel");
  }

  const especialidades = await prisma.especialidad.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  if (especialidades.length === 0) {
    return (
      <div className="record-page">
        <PageHeading
          title="Nuevo médico"
          description="Sumá un profesional y configurá su atención."
        />
        <p className="text-sm text-neutral-500">
          Primero tenés que cargar al menos una especialidad en{" "}
          <Link href="/especialidades" className="underline">
            Especialidades
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="record-page">
      <PageHeading
        title="Nuevo médico"
        description="Sumá un profesional y configurá su atención."
      />
      <MedicoForm especialidades={especialidades} />
    </div>
  );
}
