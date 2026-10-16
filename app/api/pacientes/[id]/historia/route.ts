import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { obtenerHistoriaPaciente } from "@/lib/historia";
import { medicoAtendioAlPaciente } from "@/lib/pacientes";
import { paginaSchema } from "@/lib/validations/comun";
import { ErrorClinica, conErrores } from "@/lib/errores";
async function GETHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession([
    "agenda",
    "turnos",
    "pacientes",
  ]);
  if (!session) return response;
  const { id } = await params;
  if (
    session.user.rol === "MEDICO" &&
    (!session.user.medicoId ||
      !(await medicoAtendioAlPaciente(session.user.medicoId, id)))
  )
    throw new ErrorClinica("Sin acceso", 403);
  const pagina = paginaSchema.parse(
    request.nextUrl.searchParams.get("pagina") ?? undefined,
  );
  return NextResponse.json(
    await obtenerHistoriaPaciente(id, session.user, {
      pagina,
      excluirTurnoId:
        request.nextUrl.searchParams.get("excluirTurnoId") || undefined,
    }),
  );
}
export const GET = conErrores(GETHandler);
