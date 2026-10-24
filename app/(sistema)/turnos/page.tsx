import { BandejaPendientes } from "@/components/bandeja-pendientes";
import { PageHeading } from "@/components/page-heading";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { CalendarioTurnos } from "@/components/calendario-turnos";
import { TurnosRecientes } from "@/components/turnos-recientes";

export const instant = false;

export default async function TurnosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["turnos"])
  ) {
    redirect("/panel");
  }

  return (
    <div className="record-page">
      <PageHeading
        title="Turnos"
        description="Organizá la agenda y acompañá cada consulta."
        action={{ href: "/turnos/nuevo", label: "Nuevo turno" }}
      />

      <BandejaPendientes />
      <TurnosRecientes />

      <CalendarioTurnos mostrarFiltroMedicos />
    </div>
  );
}
