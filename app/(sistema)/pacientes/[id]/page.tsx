import { redirect, notFound } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { FichaMedica } from "@/components/ficha-medica";
import { fichaSelect } from "@/lib/clinica";
import { PacienteForm } from "@/components/paciente-form";
import { HistoriaClinica } from "@/components/historia-clinica";
import { obtenerHistoriaPaciente } from "@/lib/historia";
import { pacienteSelectSeguro } from "@/lib/pacientes";

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
  if (
    !usuario ||
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["pacientes"])
  ) {
    redirect("/panel");
  }

  const { id } = await params;
  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: pacienteSelectSeguro,
  });
  if (!paciente) notFound();

  const historia = await obtenerHistoriaPaciente(id, usuario);
  const ficha =
    usuario.rol === "ADMIN"
      ? await prisma.paciente.findUnique({ where: { id }, select: fichaSelect })
      : null;

  return (
    <div className="record-page">
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

      {ficha && (
        <div className="mt-10">
          <FichaMedica
            key={`${id}:${ficha.versionFicha}`}
            pacienteId={id}
            inicial={ficha}
            puedeRegistrarVisita={false}
          />
        </div>
      )}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Historia clínica</h2>
        <HistoriaClinica
          key={paciente.id}
          entradas={historia}
          pacienteId={paciente.id}
        />
      </div>
    </div>
  );
}
