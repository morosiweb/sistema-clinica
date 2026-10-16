import { redirect, notFound } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { MedicoForm } from "@/components/medico-form";
import { HorarioManager } from "@/components/horario-manager";

export const instant = false;

export default async function EditarMedicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const [medico, especialidades] = await Promise.all([
    prisma.medico.findUnique({ where: { id }, include: { horarios: true } }),
    prisma.especialidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  if (!medico) notFound();

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">
        {medico.apellido}, {medico.nombre}
      </h1>
      <MedicoForm
        medicoId={medico.id}
        especialidades={especialidades}
        valoresIniciales={{
          nombre: medico.nombre,
          apellido: medico.apellido,
          matricula: medico.matricula ?? "",
          especialidadId: medico.especialidadId,
          telefono: medico.telefono ?? "",
          email: medico.email ?? "",
          duracionTurnoMinutos: medico.duracionTurnoMinutos,
          activo: medico.activo,
        }}
      />

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Horarios semanales</h2>
        <HorarioManager medicoId={medico.id} horarios={medico.horarios} />
      </div>
    </div>
  );
}
