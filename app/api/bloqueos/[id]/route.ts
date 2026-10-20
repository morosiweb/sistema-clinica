import { conErrores } from "@/lib/errores";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { transaccionAgenda } from "@/lib/transaccion";
import { registrarLicencia } from "@/lib/bloqueos";
import { ErrorClinica } from "@/lib/errores";
import { prisma } from "@/lib/prisma";
import { procesarAvisosReprogramacion } from "@/lib/avisos-reprogramacion";
export const maxDuration = 60;
async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["bloqueos", "medicos"]);
  if (!session) return response;
  const { estado, confirmarReprogramacion, turnosConfirmados } = z
    .object({
      estado: z.enum(["APROBADO", "RECHAZADO"]),
      confirmarReprogramacion: z.boolean().optional(),
      turnosConfirmados: z
        .array(
          z.object({
            id: z.string().min(1),
            version: z.number().int().nonnegative(),
          }),
        )
        .max(5000)
        .optional(),
    })
    .parse(await request.json());
  const id = (await params).id;
  const actual = await prisma.bloqueoMedico.findUniqueOrThrow({
    where: { id },
  });
  if (
    session.user.rol === "MEDICO" &&
    actual.medicoId !== session.user.medicoId
  )
    throw new ErrorClinica("Sin acceso", 403);
  if (estado === "APROBADO") {
    const resultado = await registrarLicencia(
      {
        medicoId: actual.medicoId,
        fecha: actual.fecha.toISOString().slice(0, 10),
        horaInicio: actual.horaInicio || "",
        horaFin: actual.horaFin || "",
        motivo: actual.motivo || "Licencia",
        confirmarReprogramacion,
        turnosConfirmados,
      },
      session.user,
      id,
    );
    if (resultado.reprogramacionId) {
      const grupo = resultado.reprogramacionId;
      after(async () => {
        await procesarAvisosReprogramacion(grupo);
      });
    }
    return NextResponse.json({
      ...resultado.bloqueos[0],
      turnosAfectados: resultado.turnosAfectados,
      notificacionesProgramadas: resultado.notificacionesProgramadas,
      sinEmail: resultado.sinEmail,
    });
  }
  const resultado = await transaccionAgenda(async (tx) => {
    const actual = await tx.bloqueoMedico.findUniqueOrThrow({ where: { id } });
    if (actual.estado !== "PENDIENTE")
      throw new ErrorClinica("La solicitud ya fue resuelta", 409);
    return tx.bloqueoMedico.update({
      where: { id },
      data: { estado, aprobadoPorId: session.user.id },
    });
  });
  return NextResponse.json(resultado);
}

export const PATCH = conErrores(PATCHHandler);

async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["bloqueos", "medicos"]);
  if (!session) return response;
  const { id } = await params;
  // Se conserva la ausencia como rechazada para no borrar su registro.
  await transaccionAgenda(async (tx) => {
    const actual = await tx.bloqueoMedico.findUniqueOrThrow({ where: { id } });
    if (
      session.user.rol === "MEDICO" &&
      actual.medicoId !== session.user.medicoId
    )
      throw new ErrorClinica("Sin acceso", 403);
    await tx.bloqueoMedico.update({
      where: { id },
      data: { estado: "RECHAZADO", aprobadoPorId: session.user.id },
    });
  });
  return NextResponse.json({ ok: true });
}
export const DELETE = conErrores(DELETEHandler);
