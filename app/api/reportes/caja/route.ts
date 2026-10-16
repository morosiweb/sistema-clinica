import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { rangoSchema } from "@/lib/validations/comun";
import { rangoInstantes, fechaDB, sumarDias } from "@/lib/fecha";
async function GETHandler(request: NextRequest) {
  const { session, response } = await requireSession(["reportes"]);
  if (!session) return response;
  const { desde, hasta } = rangoSchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const rango = rangoInstantes(desde, hasta);
  const [pagos, anulados, sinCobrar] = await Promise.all([
    prisma.pago.findMany({
      where: { fecha: rango },
      select: { monto: true, metodo: true },
    }),
    prisma.pago.findMany({
      where: { anuladoEl: rango },
      select: { monto: true, metodo: true },
    }),
    prisma.turno.findMany({
      where: {
        estado: "ATENDIDO",
        fecha: { gte: fechaDB(desde), lt: fechaDB(sumarDias(hasta, 1)) },
        pagos: { none: { anuladoEl: null } },
      },
      include: {
        paciente: { select: { nombre: true, apellido: true } },
        medico: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha: "desc" },
      take: 200,
    }),
  ]);
  // Se computa la contrapartida el día de anulación; el cobro original no
  // desaparece del cierre histórico del día en que se realizó.
  const porMetodo: Record<string, number> = {};
  let centavos = 0;
  for (const [movimientos, signo] of [
    [pagos, 1],
    [anulados, -1],
  ] as const)
    for (const p of movimientos) {
      const monto = Math.round(Number(p.monto) * 100) * signo;
      centavos += monto;
      porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + monto;
    }
  return NextResponse.json({
    total: centavos / 100,
    porMetodo: Object.fromEntries(
      Object.entries(porMetodo).map(([k, v]) => [k, v / 100]),
    ),
    cantidadPagos: pagos.length,
    cantidadAnulaciones: anulados.length,
    turnosSinCobrar: sinCobrar.map((t) => ({
      id: t.id,
      fecha: t.fecha.toISOString(),
      horaInicio: t.horaInicio,
      paciente: `${t.paciente.apellido}, ${t.paciente.nombre}`,
      medico: `${t.medico.apellido}, ${t.medico.nombre}`,
    })),
  });
}

export const GET = conErrores(GETHandler);
