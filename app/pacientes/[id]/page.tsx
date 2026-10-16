import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { PacienteForm } from "@/components/paciente-form";
import { HistoriaClinica } from "@/components/historia-clinica";
import { obtenerHistoriaPaciente } from "@/lib/historia";

export const instant = false;

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { rol: true, permisos: true, medicoId: true },
  });
  if (!usuario || !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["pacientes"])) {
    redirect("/panel");
  }

  const { id } = await params;
  const paciente = await prisma.paciente.findUnique({ where: { id } });
  if (!paciente) notFound();

  const historia = await obtenerHistoriaPaciente(id, usuario);

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">
        {paciente.apellido}, {paciente.nombre}
      </h1>
      <PacienteForm
        pacienteId={paciente.id}
        valoresIniciales={{
          dni: paciente.dni,
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          telefono: paciente.telefono ?? "",
          email: paciente.email ?? "",
          fechaNacimiento: paciente.fechaNacimiento
            ? paciente.fechaNacimiento.toISOString().slice(0, 10)
            : "",
          obraSocial: paciente.obraSocial ?? "",
        }}
      />

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Historia clínica</h2>
        <HistoriaClinica entradas={historia} />
      </div>
    </div>
  );
}
