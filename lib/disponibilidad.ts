import { prisma } from "@/lib/prisma";
import type { DiaSemana } from "@/app/generated/prisma/client";

const DIAS_POR_INDICE: DiaSemana[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

function minutosDesdeMedianoche(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(minutos: number): string {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutos % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// fechaISO: "YYYY-MM-DD". Calcula los horarios de inicio disponibles ese día
// para el médico: horario base del día - turnos ya tomados - bloqueos aprobados.
// No se pre-generan ni guardan: se calculan en el momento, como pide el plan.
export async function obtenerSlotsDisponibles(medicoId: string, fechaISO: string): Promise<string[]> {
  const fecha = new Date(`${fechaISO}T00:00:00.000Z`);
  const diaSemana = DIAS_POR_INDICE[fecha.getUTCDay()];

  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { duracionTurnoMinutos: true },
  });
  if (!medico) return [];

  const [horarios, turnos, bloqueos] = await Promise.all([
    prisma.horarioMedico.findMany({ where: { medicoId, diaSemana } }),
    prisma.turno.findMany({
      where: { medicoId, fecha, estado: { not: "CANCELADO" } },
      select: { horaInicio: true, horaFin: true },
    }),
    prisma.bloqueoMedico.findMany({
      where: { medicoId, fecha, estado: "APROBADO" },
      select: { horaInicio: true, horaFin: true },
    }),
  ]);

  const ocupados = [
    ...turnos.map((t) => ({
      inicio: minutosDesdeMedianoche(t.horaInicio),
      fin: minutosDesdeMedianoche(t.horaFin),
    })),
    ...bloqueos.map((b) => ({
      inicio: b.horaInicio ? minutosDesdeMedianoche(b.horaInicio) : 0,
      fin: b.horaFin ? minutosDesdeMedianoche(b.horaFin) : 24 * 60,
    })),
  ];

  const duracion = medico.duracionTurnoMinutos;
  const slots: string[] = [];

  for (const h of horarios) {
    const inicioBloque = minutosDesdeMedianoche(h.horaInicio);
    const finBloque = minutosDesdeMedianoche(h.horaFin);
    for (let t = inicioBloque; t + duracion <= finBloque; t += duracion) {
      const solapa = ocupados.some((o) => t < o.fin && t + duracion > o.inicio);
      if (!solapa) slots.push(hhmm(t));
    }
  }

  return slots.sort();
}
