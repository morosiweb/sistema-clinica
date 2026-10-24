import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { conErrores } from "@/lib/errores";
import { prisma } from "@/lib/prisma";
import { fechaDB, fechaClinica } from "@/lib/fecha";
import { paginaSchema } from "@/lib/validations/comun";

const contactos = {
  paciente: { select: { nombre: true, apellido: true, telefono: true } },
  medico: { select: { nombre: true, apellido: true } },
} as const;
export const GET = conErrores(async (request: NextRequest) => {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;
  const pagina = paginaSchema.parse(
    request.nextUrl.searchParams.get("pagina") ?? undefined,
  );
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "reservas";
  const desde = fechaDB(fechaClinica());
  const [reservas, reprogramaciones, avisos, recordatorios, licencias] =
    await Promise.all([
      prisma.turno.count({
        where: { estado: "PENDIENTE", fecha: { gte: desde } },
      }),
      prisma.turno.count({
        where: { requiereReprogramacion: true, estado: "CANCELADO" },
      }),
      prisma.avisoTurno.count({
        where: { enviado: false, descartado: false, error: { not: null } },
      }),
      prisma.turno.count({
        where: {
          estado: "CONFIRMADO",
          fecha: { gte: desde },
          recordatorioError: { not: null },
          recordatorioEnviado: false,
        },
      }),
      prisma.turno.count({
        where: {
          requiereReprogramacion: true,
          estado: "CANCELADO",
          avisoReprogramacionEnviado: false,
          avisoReprogramacionError: { not: null },
        },
      }),
    ]);
  const resumen = {
    reservas,
    reprogramaciones,
    avisos: avisos + recordatorios + licencias,
  };
  if (tipo !== "avisos") {
    const datos = await prisma.turno.findMany({
      where:
        tipo === "reprogramaciones"
          ? { requiereReprogramacion: true, estado: "CANCELADO" }
          : { estado: "PENDIENTE", fecha: { gte: desde } },
      include: contactos,
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }, { id: "asc" }],
      skip: (pagina - 1) * 25,
      take: 26,
    });
    return NextResponse.json({
      resumen,
      hayMas: datos.length > 25,
      entradas: datos.slice(0, 25).map((t) => ({
        id: t.id,
        turnoId: t.id,
        tipo,
        paciente: `${t.paciente.apellido}, ${t.paciente.nombre}`,
        telefono: t.paciente.telefono,
        medico: `${t.medico.apellido}, ${t.medico.nombre}`,
        fecha: t.fecha,
        horaInicio: t.horaInicio,
        version: t.version,
        error: null,
      })),
    });
  }
  const offset = (pagina - 1) * 25;
  const tramo = (base: number, cantidad: number) => {
    const skip = Math.max(0, offset - base),
      fin = Math.min(cantidad, offset + 25 - base);
    return { skip, take: Math.max(0, fin - skip) };
  };
  const normal = tramo(0, avisos),
    recordatorio = tramo(avisos, recordatorios),
    licencia = tramo(avisos + recordatorios, licencias);
  const [normales, recordatoriosFallidos, licenciasFallidas] =
    await Promise.all([
      normal.take
        ? prisma.avisoTurno.findMany({
            where: { enviado: false, descartado: false, error: { not: null } },
            include: { turno: { include: contactos } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            ...normal,
          })
        : [],
      recordatorio.take
        ? prisma.turno.findMany({
            where: {
              estado: "CONFIRMADO",
              fecha: { gte: desde },
              recordatorioEnviado: false,
              recordatorioError: { not: null },
            },
            include: contactos,
            orderBy: [{ fecha: "asc" }, { id: "asc" }],
            ...recordatorio,
          })
        : [],
      licencia.take
        ? prisma.turno.findMany({
            where: {
              requiereReprogramacion: true,
              estado: "CANCELADO",
              avisoReprogramacionEnviado: false,
              avisoReprogramacionError: { not: null },
            },
            include: contactos,
            orderBy: [{ fecha: "asc" }, { id: "asc" }],
            ...licencia,
          })
        : [],
    ]);
  const entrada = (
    t: (typeof recordatoriosFallidos)[number],
    id: string,
    tipo: string,
    error: string | null,
  ) => ({
    id,
    turnoId: t.id,
    tipo,
    paciente: `${t.paciente.apellido}, ${t.paciente.nombre}`,
    telefono: t.paciente.telefono,
    medico: `${t.medico.apellido}, ${t.medico.nombre}`,
    fecha: t.fecha,
    horaInicio: t.horaInicio,
    version: t.version,
    error,
  });
  const entradas = [
    ...normales.map((a) => entrada(a.turno, a.id, "aviso", a.error)),
    ...recordatoriosFallidos.map((t) =>
      entrada(t, t.id, "recordatorio", t.recordatorioError),
    ),
    ...licenciasFallidas.map((t) =>
      entrada(t, t.id, "licencia", t.avisoReprogramacionError),
    ),
  ];
  return NextResponse.json({
    resumen,
    hayMas: offset + entradas.length < resumen.avisos,
    entradas,
  });
});
