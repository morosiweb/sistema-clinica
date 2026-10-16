import { redirect } from "next/navigation";
import { authVigente } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { BloqueosManager } from "@/components/bloqueos-manager";
export const instant = false;
export default async function BloqueosPage() {
  const session = await authVigente();
  if (!session) redirect("/api/auth/sesion-invalida");
  const yo = await prisma.usuarioInterno.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { permisos: true },
  });
  if (!puedeVer(parsePermisos(yo.permisos), session.user.rol, ["bloqueos"]))
    redirect("/panel");
  const medicos = await prisma.medico.findMany({
    where: {
      activo: true,
      ...(session.user.rol === "MEDICO"
        ? { id: session.user.medicoId || "__ninguno__" }
        : {}),
    },
    select: { id: true, nombre: true, apellido: true },
    orderBy: { apellido: "asc" },
  });
  return (
    <div className="record-page">
      <h1 className="mb-6 text-xl font-semibold">Licencias y ausencias</h1>
      <BloqueosManager
        medicos={medicos}
        esMedico={session.user.rol === "MEDICO"}
      />
    </div>
  );
}
