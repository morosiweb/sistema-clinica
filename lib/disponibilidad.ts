import { prisma } from "@/lib/prisma";
import type { DiaSemana } from "@/app/generated/prisma/client";
import type { Transaccion } from "@/lib/transaccion";
import { fechaDB, fechaClinica, sumarDias, instanteClinica } from "@/lib/fecha";
import { fechaSchema } from "@/lib/validations/comun";

const DIAS: DiaSemana[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];
export function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}
export function horaDesdeMinutos(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
}
export function solapa(a: string, b: string, c: string, d: string) {
  return a < d && b > c;
}

export async function slotsDetallados(
  medicoId: string,
  dia: string,
  db: Transaccion = prisma,
  excluirTurnoId?: string,
) {
  fechaSchema.parse(dia);
  const fecha = fechaDB(dia);
  const medico = await db.medico.findUnique({
    where: { id: medicoId },
    select: { activo: true, duracionTurnoMinutos: true },
  });
  if (!medico?.activo) return [];
  const [horarios, turnos, bloqueos] = await Promise.all([
    db.horarioMedico.findMany({
      where: {
        medicoId,
        diaSemana: DIAS[fecha.getUTCDay()],
        AND: [
          { OR: [{ vigenteDesde: null }, { vigenteDesde: { lte: fecha } }] },
          { OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }] },
        ],
      },
    }),
    db.turno.findMany({
      where: {
        medicoId,
        fecha,
        estado: { not: "CANCELADO" },
        ...(excluirTurnoId ? { id: { not: excluirTurnoId } } : {}),
      },
      select: { horaInicio: true, horaFin: true },
    }),
    db.bloqueoMedico.findMany({
      where: { medicoId, fecha, estado: "APROBADO" },
      select: { horaInicio: true, horaFin: true },
    }),
  ]);
  const ocupados = [
    ...turnos,
    ...bloqueos.map((b) => ({
      horaInicio: b.horaInicio ?? "00:00",
      horaFin: b.horaFin ?? "24:00",
    })),
  ];
  const resultado = new Map<string, { horaInicio: string; horaFin: string }>();
  const ahora = Date.now();
  for (const h of horarios) {
    const duracion = h.duracionTurno ?? medico.duracionTurnoMinutos;
    for (
      let t = minutos(h.horaInicio);
      t + duracion <= minutos(h.horaFin);
      t += duracion
    ) {
      const horaInicio = horaDesdeMinutos(t),
        horaFin = horaDesdeMinutos(t + duracion);
      if (instanteClinica(dia, horaInicio).getTime() <= ahora) continue;
      if (
        !ocupados.some((o) =>
          solapa(horaInicio, horaFin, o.horaInicio, o.horaFin),
        )
      )
        resultado.set(horaInicio, { horaInicio, horaFin });
    }
  }
  return [...resultado.values()].sort((a, b) =>
    a.horaInicio.localeCompare(b.horaInicio),
  );
}

export async function obtenerSlotsDisponibles(medicoId: string, fecha: string) {
  return (await slotsDetallados(medicoId, fecha)).map((s) => s.horaInicio);
}

export async function obtenerProximaDisponibilidad(
  medicoId: string,
  desde: string,
) {
  fechaSchema.parse(desde);
  const inicio = desde < fechaClinica() ? fechaClinica() : desde;
  const fin = sumarDias(inicio, 59);
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { activo: true, duracionTurnoMinutos: true },
  });
  if (!medico?.activo) return null;
  const [horarios, turnos, bloqueos] = await Promise.all([
    prisma.horarioMedico.findMany({ where: { medicoId } }),
    prisma.turno.findMany({
      where: {
        medicoId,
        fecha: { gte: fechaDB(inicio), lte: fechaDB(fin) },
        estado: { not: "CANCELADO" },
      },
      select: { fecha: true, horaInicio: true, horaFin: true },
    }),
    prisma.bloqueoMedico.findMany({
      where: {
        medicoId,
        fecha: { gte: fechaDB(inicio), lte: fechaDB(fin) },
        estado: "APROBADO",
      },
      select: { fecha: true, horaInicio: true, horaFin: true },
    }),
  ]);
  const ahora = Date.now();
  for (let dia = inicio; dia <= fin; dia = sumarDias(dia, 1)) {
    const fecha = fechaDB(dia);
    const ocupados = [
      ...turnos.filter((t) => t.fecha.getTime() === fecha.getTime()),
      ...bloqueos
        .filter((b) => b.fecha.getTime() === fecha.getTime())
        .map((b) => ({
          horaInicio: b.horaInicio ?? "00:00",
          horaFin: b.horaFin ?? "24:00",
        })),
    ];
    const disponibles: string[] = [];
    for (const h of horarios.filter(
      (h) =>
        h.diaSemana === DIAS[fecha.getUTCDay()] &&
        (!h.vigenteDesde || h.vigenteDesde <= fecha) &&
        (!h.vigenteHasta || h.vigenteHasta >= fecha),
    )) {
      const duracion = h.duracionTurno ?? medico.duracionTurnoMinutos;
      for (
        let m = minutos(h.horaInicio);
        m + duracion <= minutos(h.horaFin);
        m += duracion
      ) {
        const horaInicio = horaDesdeMinutos(m),
          horaFin = horaDesdeMinutos(m + duracion);
        if (
          instanteClinica(dia, horaInicio).getTime() > ahora &&
          !ocupados.some((o) =>
            solapa(horaInicio, horaFin, o.horaInicio, o.horaFin),
          )
        )
          disponibles.push(horaInicio);
      }
    }
    disponibles.sort();
    if (disponibles.length) return { fecha: dia, horaInicio: disponibles[0] };
  }
  return null;
}
