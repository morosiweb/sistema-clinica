import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { bloqueoSchema } from "@/lib/validations/bloqueo";
import { transaccionAgenda } from "@/lib/transaccion";
import { validarBloqueo } from "@/lib/bloqueos";
import { fechaDB, fechaClinica } from "@/lib/fecha";
import { ErrorClinica } from "@/lib/errores";
async function GETHandler() {
  const { session, response } = await requireSession(["bloqueos"]);
  if (!session) return response;
  const bloqueos = await prisma.bloqueoMedico.findMany({
    where:
      session.user.rol === "MEDICO"
        ? { medicoId: session.user.medicoId || "__ninguno__" }
        : {},
    include: { medico: { select: { nombre: true, apellido: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 100,
  });
  return NextResponse.json(bloqueos);
}
async function POSTHandler(request: NextRequest) {
  const { session, response } = await requireSession(["bloqueos"]);
  if (!session) return response;
  const data = bloqueoSchema.parse(await request.json());
  if (session.user.rol === "MEDICO" && session.user.medicoId !== data.medicoId)
    throw new ErrorClinica("Sin acceso", 403);
  if (data.fecha < fechaClinica())
    throw new ErrorClinica("La licencia debe ser actual o futura");
  const aprobado = session.user.rol !== "MEDICO";
  const bloqueo = await transaccionAgenda(async (tx) => {
    const medico = await tx.medico.findUnique({
      where: { id: data.medicoId },
      select: { activo: true },
    });
    if (!medico?.activo) throw new ErrorClinica("Médico no disponible");
    if (aprobado) await validarBloqueo(tx, data);
    return tx.bloqueoMedico.create({
      data: {
        medicoId: data.medicoId,
        fecha: fechaDB(data.fecha),
        horaInicio: data.horaInicio || null,
        horaFin: data.horaFin || null,
        motivo: data.motivo,
        estado: aprobado ? "APROBADO" : "PENDIENTE",
        aprobadoPorId: aprobado ? session.user.id : null,
      },
    });
  });
  return NextResponse.json(bloqueo, { status: 201 });
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
