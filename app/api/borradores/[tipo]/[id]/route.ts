import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { conErrores, ErrorClinica } from "@/lib/errores";
import { comprobarAccesoPaciente } from "@/lib/documentacion-paciente";
import { MAX_NOTA_CLINICA } from "@/lib/estados-turno";
type Contexto = { params: Promise<{ tipo: string; id: string }> };
const schemas = {
  nota: z.object({ notasMedico: z.string().max(MAX_NOTA_CLINICA) }).strict(),
  ficha: z
    .object({
      pesoKg: z.string().max(12),
      alturaCm: z.string().max(12),
      grupoSanguineo: z.string().max(10),
      alergias: z.string().max(500),
      antecedentes: z.string().max(1000),
    })
    .strict(),
  visita: z
    .object({
      fecha: z.string().max(10),
      horaInicio: z.string().max(5),
      motivoConsulta: z.string().max(300),
      notasMedico: z.string().max(MAX_NOTA_CLINICA),
    })
    .strict(),
};
async function acceso(contexto: Contexto) {
  const { session, response } = await requireSession([
    "agenda",
    "pacientes",
    "turnos",
  ]);
  if (!session) return { response };
  if (session.user.rol === "SECRETARIA")
    throw new ErrorClinica("Sin acceso", 403);
  const { tipo, id } = await contexto.params;
  if (!(tipo in schemas) || !id || id.length > 100)
    throw new ErrorClinica("Borrador no encontrado", 404);
  let pacienteId = id;
  if (tipo === "nota") {
    const turno = await prisma.turno.findUniqueOrThrow({
      where: { id },
      select: {
        pacienteId: true,
        medicoId: true,
        medico: { select: { activo: true } },
      },
    });
    if (
      session.user.rol === "MEDICO" &&
      (turno.medicoId !== session.user.medicoId || !turno.medico.activo)
    )
      throw new ErrorClinica("Sin acceso", 403);
    pacienteId = turno.pacienteId;
  } else await comprobarAccesoPaciente(id, session.user);
  return {
    session,
    tipo: tipo as keyof typeof schemas,
    id,
    pacienteId,
    response: null,
  };
}
export const GET = conErrores(
  async (_request: NextRequest, context: Contexto) => {
    const a = await acceso(context);
    if (!a.session) return a.response;
    const borrador = await prisma.borradorClinico.findUnique({
      where: {
        usuarioId_tipo_referenciaId: {
          usuarioId: a.session.user.id,
          tipo: a.tipo,
          referenciaId: a.id,
        },
      },
      select: {
        id: true,
        contenido: true,
        versionBase: true,
        revision: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ borrador });
  },
);
export const PUT = conErrores(
  async (request: NextRequest, context: Contexto) => {
    const a = await acceso(context);
    if (!a.session) return a.response;
    const data = z
      .object({
        contenido: schemas[a.tipo],
        versionBase: z.number().int().nonnegative(),
        revision: z.number().int().nonnegative(),
        borradorId: z.string().min(1).max(100).nullable().optional(),
      })
      .parse(await request.json());
    const usuarioId = a.session.user.id,
      clave = { usuarioId, tipo: a.tipo, referenciaId: a.id };
    const borrador = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`borrador:${usuarioId}:${a.tipo}:${a.id}`}))`;
      const anterior = await tx.borradorClinico.findUnique({
        where: { usuarioId_tipo_referenciaId: clave },
      });
      if (
        (anterior?.revision ?? 0) !== data.revision ||
        (anterior ? anterior.id !== data.borradorId : !!data.borradorId)
      )
        throw new ErrorClinica(
          "Este borrador cambió en otra pestaña. Volvé a abrir la ficha para revisarlo.",
          409,
        );
      return tx.borradorClinico.upsert({
        where: { usuarioId_tipo_referenciaId: clave },
        create: {
          ...clave,
          pacienteId: a.pacienteId,
          contenido: data.contenido,
          versionBase: data.versionBase,
        },
        update: {
          contenido: data.contenido,
          versionBase: data.versionBase,
          revision: { increment: 1 },
        },
        select: { id: true, revision: true },
      });
    });
    return NextResponse.json(borrador);
  },
);
export const DELETE = conErrores(
  async (request: NextRequest, context: Contexto) => {
    const a = await acceso(context);
    if (!a.session) return a.response;
    const { revision, borradorId } = z
      .object({
        revision: z.number().int().nonnegative(),
        borradorId: z.string().min(1).max(100),
      })
      .parse(await request.json());
    await prisma.borradorClinico.deleteMany({
      where: {
        usuarioId: a.session.user.id,
        tipo: a.tipo,
        referenciaId: a.id,
        revision,
        id: borradorId,
      },
    });
    return NextResponse.json({ ok: true });
  },
);
