import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { EstadoBadge } from "@/components/estado-badge";

export const instant = false;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true, medicoId: true },
  });
  if (!usuario || !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["agenda"])) {
    redirect("/panel");
  }
  if (!usuario.medicoId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-4 text-xl font-semibold">Mi agenda</h1>
        <p className="text-sm text-neutral-500">
          Tu usuario todavía no está vinculado a un médico. Pedile al admin que lo vincule en Usuarios.
        </p>
      </div>
    );
  }

  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaParam || new Date().toISOString().slice(0, 10);

  const turnos = await prisma.turno.findMany({
    where: { medicoId: usuario.medicoId, fecha: new Date(`${fecha}T00:00:00.000Z`) },
    include: { paciente: true },
    orderBy: { horaInicio: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Mi agenda</h1>

      <form className="mb-4">
        <input
          type="date"
          name="fecha"
          defaultValue={fecha}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </form>

      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {turnos.map((t) => (
          <Link
            key={t.id}
            href={`/turnos/${t.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{t.horaInicio}</span>
              <span>
                {t.paciente.apellido}, {t.paciente.nombre}
              </span>
            </div>
            <EstadoBadge estado={t.estado} />
          </Link>
        ))}
        {turnos.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">No tenés turnos ese día.</p>
        )}
      </div>
    </div>
  );
}
