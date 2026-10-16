import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { EstadoBadge } from "@/components/estado-badge";

export const instant = false;

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; medicoId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true },
  });
  if (!usuario || !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["turnos"])) {
    redirect("/");
  }

  const { fecha: fechaParam, medicoId } = await searchParams;
  const fecha = fechaParam || new Date().toISOString().slice(0, 10);

  const [turnos, medicos] = await Promise.all([
    prisma.turno.findMany({
      where: {
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        ...(medicoId ? { medicoId } : {}),
      },
      include: { paciente: true, medico: true },
      orderBy: { horaInicio: "asc" },
    }),
    prisma.medico.findMany({ orderBy: { apellido: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Turnos</h1>
        <Link
          href="/turnos/nuevo"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Nuevo turno
        </Link>
      </div>

      <form className="mb-4 flex gap-2">
        <input
          type="date"
          name="fecha"
          defaultValue={fecha}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
        <select
          name="medicoId"
          defaultValue={medicoId ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">Todos los médicos</option>
          {medicos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.apellido}, {m.nombre}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          Filtrar
        </button>
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
              <span className="text-neutral-500">
                {t.medico.apellido}, {t.medico.nombre}
              </span>
            </div>
            <EstadoBadge estado={t.estado} />
          </Link>
        ))}
        {turnos.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">
            No hay turnos para esa fecha.
          </p>
        )}
      </div>
    </div>
  );
}
