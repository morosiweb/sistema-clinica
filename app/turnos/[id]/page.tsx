import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";
import { TurnoDetalle } from "@/components/turno-detalle";
import { obtenerHistoriaPaciente } from "@/lib/historia";

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
  if (!usuario || !puedeVer(parsePermisos(usuario.permisos), usuario.rol, ["turnos", "agenda"])) {
    redirect("/");
  }

  const { id } = await params;
  const turno = await prisma.turno.findUnique({
    where: { id },
    include: {
      paciente: true,
      medico: { include: { especialidad: true } },
      historial: { orderBy: { fecha: "desc" } },
    },
  });
  if (!turno) notFound();

  if (usuario.rol === "MEDICO" && turno.medicoId !== usuario.medicoId) {
    redirect("/agenda");
  }

  const historiaPaciente = await obtenerHistoriaPaciente(turno.pacienteId, usuario, {
    excluirTurnoId: turno.id,
  });

  // ADMIN o el propio médico tratante. Secretaria no recibe el contenido ni
  // siquiera en el payload (no solo oculto en la UI).
  const puedeVerNotasMedico = usuario.rol === "ADMIN" || turno.medicoId === usuario.medicoId;

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Turno</h1>
      <TurnoDetalle
        turno={{
          ...turno,
          notasMedico: puedeVerNotasMedico ? turno.notasMedico : null,
          fecha: turno.fecha.toISOString(),
          historial: turno.historial.map((h) => ({ ...h, fecha: h.fecha.toISOString() })),
        }}
        esMedico={usuario.rol === "MEDICO"}
        puedeVerNotasMedico={puedeVerNotasMedico}
        historiaPaciente={historiaPaciente}
      />
    </div>
  );
}
