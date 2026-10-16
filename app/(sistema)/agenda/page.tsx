import { PageHeading } from "@/components/page-heading";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { CalendarioTurnos } from "@/components/calendario-turnos";

export const instant = false;

export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true, medicoId: true },
  });
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["agenda"])
  ) {
    redirect("/panel");
  }
  if (!usuario.medicoId) {
    return (
      <div className="record-page">
        <PageHeading
          title="Mi agenda"
          description="Tus consultas y pacientes, organizados en un solo lugar."
        />
        <p className="text-sm text-neutral-500">
          Tu usuario todavía no está vinculado a un médico. Pedile al admin que
          lo vincule en Usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="record-page">
      <PageHeading
        title="Mi agenda"
        description="Tus consultas y pacientes, organizados en un solo lugar."
      />
      <CalendarioTurnos mostrarFiltroMedicos={false} />
    </div>
  );
}
