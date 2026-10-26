import { redirect, notFound } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { MedicoForm } from "@/components/medico-form";
import { HorarioManager } from "@/components/horario-manager";
import { MedicoAcceso } from "@/components/medico-acceso";
import { BloqueosManager } from "@/components/bloqueos-manager";

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
    prisma.medico.findUnique({
      where: { id },
      include: {
        horarios: true,
        usuarioInterno: {
          select: { email: true, activo: true, versionSesion: true },
        },
      },
    }),
    prisma.especialidad.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  if (!medico) notFound();

  return (
    <div className="record-page record-page-inset record-page-form">
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
          color: medico.color,
        }}
      />

      <MedicoAcceso
        medicoId={medico.id}
        nombre={`${medico.nombre} ${medico.apellido}`}
        emailMedico={medico.email ?? ""}
        activo={medico.activo}
        cuenta={medico.usuarioInterno}
      />

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">
          Vacaciones y tiempos libres
        </h2>
        <BloqueosManager
          medicos={[
            { id: medico.id, nombre: medico.nombre, apellido: medico.apellido },
          ]}
          esMedico={false}
          medicoFijo={medico.id}
        />
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Horarios semanales</h2>
        <HorarioManager medicoId={medico.id} horarios={medico.horarios} />
      </div>
    </div>
  );
}
