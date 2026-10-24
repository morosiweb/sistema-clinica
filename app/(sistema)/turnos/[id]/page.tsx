import { redirect, notFound } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { TurnoDetalle } from "@/components/turno-detalle";
import { obtenerHistoriaPaciente } from "@/lib/historia";
import Link from "next/link";

export const instant = false;

export default async function TurnoDetallePage({
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
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, [
      "turnos",
      "agenda",
    ])
  ) {
    redirect("/panel");
  }

  const { id } = await params;
  const turno = await prisma.turno.findUnique({
    where: { id },
    include: {
      // Nunca traer el paciente completo acá: tokenAccesoHash/tokenAccesoEnc
      // (su link de acceso) no deben llegar al cliente.
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          dni: true,
          telefono: true,
          versionFicha: true,
          pesoKg: true,
          alturaCm: true,
          grupoSanguineo: true,
          alergias: true,
          antecedentes: true,
        },
      },
      medico: { include: { especialidad: true } },
      historial: { orderBy: { fecha: "desc" }, take: 100 },
    },
  });
  if (!turno) notFound();

  if (usuario.rol === "MEDICO" && turno.medicoId !== usuario.medicoId) {
    redirect("/agenda");
  }

  const historiaPaciente = await obtenerHistoriaPaciente(
    turno.pacienteId,
    usuario,
    {
      excluirTurnoId: turno.id,
    },
  );

  // ADMIN o el propio médico tratante. Secretaria no recibe el contenido ni
  // siquiera en el payload (no solo oculto en la UI).
  const puedeVerNotasMedico =
    usuario.rol === "ADMIN" || turno.medicoId === usuario.medicoId;

  return (
    <div className="record-page">
      <h1 className="mb-6 text-xl font-semibold">Turno</h1>
      <Link
        className="btn btn-outline mb-5"
        href={`/pacientes/${turno.pacienteId}`}
      >
        Ver ficha, notas y archivos del paciente
      </Link>
      <TurnoDetalle
        key={turno.id}
        turno={{
          ...turno,
          notasMedico: puedeVerNotasMedico ? turno.notasMedico : null,
          paciente: {
            ...turno.paciente,
            ...(puedeVerNotasMedico
              ? {}
              : {
                  pesoKg: null,
                  alturaCm: null,
                  grupoSanguineo: null,
                  alergias: null,
                  antecedentes: null,
                }),
          },
          fecha: turno.fecha.toISOString(),
          historial: turno.historial.map((h) => ({
            ...h,
            fecha: h.fecha.toISOString(),
          })),
        }}
        esMedico={usuario.rol === "MEDICO"}
        puedeVerNotasMedico={puedeVerNotasMedico}
        historiaPaciente={historiaPaciente}
      />
    </div>
  );
}
