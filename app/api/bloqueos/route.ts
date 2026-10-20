import { conErrores } from "@/lib/errores";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { bloqueoSchema } from "@/lib/validations/bloqueo";
import { registrarLicencia } from "@/lib/bloqueos";
import { procesarAvisosReprogramacion } from "@/lib/avisos-reprogramacion";
export const maxDuration = 60;
async function GETHandler(request: NextRequest) {
  const { session, response } = await requireSession(["bloqueos", "medicos"]);
  if (!session) return response;
  const bloqueos = await prisma.bloqueoMedico.findMany({
    where:
      session.user.rol === "MEDICO"
        ? { medicoId: session.user.medicoId || "__ninguno__" }
        : request.nextUrl.searchParams.get("medicoId")
          ? { medicoId: request.nextUrl.searchParams.get("medicoId")! }
          : {},
    include: { medico: { select: { nombre: true, apellido: true } } },
    orderBy: [{ createdAt: "desc" }, { fecha: "asc" }, { id: "asc" }],
    take: 100,
  });
  return NextResponse.json(bloqueos);
}
async function POSTHandler(request: NextRequest) {
  const { session, response } = await requireSession(["bloqueos", "medicos"]);
  if (!session) return response;
  const data = bloqueoSchema.parse(await request.json());
  const resultado = await registrarLicencia(data, session.user);
  if (resultado.reprogramacionId) {
    const grupo = resultado.reprogramacionId;
    after(async () => {
      await procesarAvisosReprogramacion(grupo);
    });
  }
  const { bloqueos, turnosAfectados, notificacionesProgramadas, sinEmail } =
    resultado;
  const resumen = { turnosAfectados, notificacionesProgramadas, sinEmail };
  return NextResponse.json(
    data.fechaHasta
      ? { bloqueos, cantidad: bloqueos.length, ...resumen }
      : { ...bloqueos[0], ...resumen },
    { status: 201 },
  );
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
