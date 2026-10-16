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
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-4 text-xl font-semibold">Mi agenda</h1>
        <p className="text-sm text-neutral-500">
          Tu usuario todavía no está vinculado a un médico. Pedile al admin que
          lo vincule en Usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Mi agenda</h1>
      <CalendarioTurnos mostrarFiltroMedicos={false} />
    </div>
  );
}
