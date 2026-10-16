import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { session, response } = await requireSession(["reportes"]);
  if (!session) return response;

  const desde = request.nextUrl.searchParams.get("desde");
  const hasta = request.nextUrl.searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan desde y hasta" }, { status: 400 });
  }

  const rangoFecha = {
    gte: new Date(`${desde}T00:00:00.000Z`),
    lte: new Date(`${hasta}T23:59:59.999Z`),
  };

  const [pagos, turnosSinCobrar] = await Promise.all([
    prisma.pago.findMany({
      where: { fecha: rangoFecha },
      select: { monto: true, metodo: true },
    }),
    prisma.turno.findMany({
      where: {
        estado: "ATENDIDO",
        fecha: {
          gte: new Date(`${desde}T00:00:00.000Z`),
          lte: new Date(`${hasta}T23:59:59.999Z`),
        },
        pagos: { none: {} },
      },
      include: { paciente: { select: { nombre: true, apellido: true } }, medico: true },
      orderBy: { fecha: "desc" },
    }),
  ]);

  const porMetodo: Record<string, number> = {};
  let total = 0;
  for (const p of pagos) {
    const monto = Number(p.monto);
    total += monto;
    porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + monto;
  }

  return NextResponse.json({
    total,
    porMetodo,
    cantidadPagos: pagos.length,
    turnosSinCobrar: turnosSinCobrar.map((t) => ({
      id: t.id,
      fecha: t.fecha.toISOString(),
      horaInicio: t.horaInicio,
      paciente: `${t.paciente.apellido}, ${t.paciente.nombre}`,
      medico: `${t.medico.apellido}, ${t.medico.nombre}`,
    })),
  });
}
