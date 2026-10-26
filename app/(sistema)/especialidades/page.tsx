import { PageHeading } from "@/components/page-heading";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
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
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["especialidades"])
  ) {
    redirect("/panel");
  }

  const especialidades = await prisma.especialidad.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="record-page record-page-inset record-page-form">
      <PageHeading
        title="Especialidades"
        description="Organizá las áreas de atención disponibles en la clínica."
      />
      <EspecialidadManager especialidades={especialidades} />
    </div>
  );
}
