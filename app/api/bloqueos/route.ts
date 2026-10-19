import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { bloqueoSchema } from "@/lib/validations/bloqueo";
import { transaccionAgenda } from "@/lib/transaccion";
import { validarBloqueo } from "@/lib/bloqueos";
import { fechaDB, fechaClinica, sumarDias } from "@/lib/fecha";
import { ErrorClinica } from "@/lib/errores";
import { randomUUID } from "node:crypto";
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
  if (session.user.rol === "MEDICO" && session.user.medicoId !== data.medicoId)
    throw new ErrorClinica("Sin acceso", 403);
  if (data.fecha < fechaClinica())
    throw new ErrorClinica("La licencia debe ser actual o futura");
  const aprobado = session.user.rol !== "MEDICO";
  const bloqueos = await transaccionAgenda(async (tx) => {
    const medico = await tx.medico.findUnique({
      where: { id: data.medicoId },
      select: { activo: true },
    });
    if (!medico?.activo) throw new ErrorClinica("Médico no disponible");
    const fechas: string[] = [];
    for (
      let fecha = data.fecha;
      fecha <= (data.fechaHasta || data.fecha);
      fecha = sumarDias(fecha, 1)
    )
      fechas.push(fecha);
    // Se comprueba el período completo antes de guardar. Un conflicto revierte todo.
    if (aprobado) await validarBloqueo(tx, data);
    const datos = fechas.map((fecha) => ({
      id: randomUUID(),
      medicoId: data.medicoId,
      fecha: fechaDB(fecha),
      horaInicio: data.horaInicio || null,
      horaFin: data.horaFin || null,
      motivo: data.motivo,
      estado: aprobado ? ("APROBADO" as const) : ("PENDIENTE" as const),
      aprobadoPorId: aprobado ? session.user.id : null,
    }));
    await tx.bloqueoMedico.createMany({ data: datos });
    return tx.bloqueoMedico.findMany({
      where: { id: { in: datos.map((b) => b.id) } },
      orderBy: { fecha: "asc" },
    });
  });
  return NextResponse.json(
    data.fechaHasta ? { bloqueos, cantidad: bloqueos.length } : bloqueos[0],
    { status: 201 },
  );
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
