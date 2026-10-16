import { prisma } from "@/lib/prisma";

export function sumarMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export class HorarioOcupadoError extends Error {
  constructor() {
    super("HORARIO_OCUPADO");
  }
}

// Ventana mínima para que el paciente pueda cancelar o reprogramar online
// desde su link; más cerca que esto, tiene que llamar a la clínica.
export const VENTANA_MINIMA_HORAS = 4;

export function horasHastaElTurno(fecha: Date, horaInicio: string): number {
  const [h, m] = horaInicio.split(":").map(Number);
  const inicio = new Date(fecha);
  inicio.setUTCHours(h, m, 0, 0);
  return (inicio.getTime() - Date.now()) / (1000 * 60 * 60);
}

// Reserva un turno dentro de una transacción (re-chequea solapamiento justo
// antes de insertar, para no doble-reservar el mismo horario) y deja
// registrado en el historial quién la hizo.
export async function crearTurno(params: {
  pacienteId: string;
  medicoId: string;
  fecha: string; // YYYY-MM-DD
  horaInicio: string;
  motivoConsulta?: string | null;
  canalReserva: "ONLINE" | "TELEFONO" | "PRESENCIAL";
  realizadoPor: string;
}) {
  const medico = await prisma.medico.findUnique({ where: { id: params.medicoId } });
  if (!medico) throw new Error("MEDICO_NO_ENCONTRADO");

  const fecha = new Date(`${params.fecha}T00:00:00.000Z`);
  const horaFin = sumarMinutos(params.horaInicio, medico.duracionTurnoMinutos);

  return prisma.$transaction(async (tx) => {
    const solapado = await tx.turno.findFirst({
      where: {
        medicoId: params.medicoId,
        fecha,
        estado: { not: "CANCELADO" },
        horaInicio: { lt: horaFin },
        horaFin: { gt: params.horaInicio },
      },
    });
    if (solapado) throw new HorarioOcupadoError();

    const turno = await tx.turno.create({
      data: {
        pacienteId: params.pacienteId,
        medicoId: params.medicoId,
        fecha,
        horaInicio: params.horaInicio,
        horaFin,
        motivoConsulta: params.motivoConsulta || null,
        canalReserva: params.canalReserva,
      },
    });

    await tx.historialTurno.create({
      data: { turnoId: turno.id, accion: "CREADO", realizadoPor: params.realizadoPor },
    });

    return turno;
  });
}

// Reprograma un turno existente (cambia médico/fecha/hora) re-chequeando
// solapamiento, igual que crearTurno. No crea un turno nuevo: actualiza el
// mismo registro para conservar su historial y, si lo hubiera, sus pagos.
export async function reprogramarTurno(params: {
  turnoId: string;
  medicoId: string;
  fecha: string;
  horaInicio: string;
  realizadoPor: string;
}) {
  const medico = await prisma.medico.findUnique({ where: { id: params.medicoId } });
  if (!medico) throw new Error("MEDICO_NO_ENCONTRADO");

  const fecha = new Date(`${params.fecha}T00:00:00.000Z`);
  const horaFin = sumarMinutos(params.horaInicio, medico.duracionTurnoMinutos);

  return prisma.$transaction(async (tx) => {
    const solapado = await tx.turno.findFirst({
      where: {
        id: { not: params.turnoId },
        medicoId: params.medicoId,
        fecha,
        estado: { not: "CANCELADO" },
        horaInicio: { lt: horaFin },
        horaFin: { gt: params.horaInicio },
      },
    });
    if (solapado) throw new HorarioOcupadoError();

    const turno = await tx.turno.update({
      where: { id: params.turnoId },
      data: {
        medicoId: params.medicoId,
        fecha,
        horaInicio: params.horaInicio,
        horaFin,
        estado: "PENDIENTE",
        version: { increment: 1 },
      },
      include: { medico: { include: { especialidad: true } }, paciente: true },
    });

    await tx.historialTurno.create({
      data: {
        turnoId: turno.id,
        accion: "MODIFICADO",
        realizadoPor: params.realizadoPor,
        detalle: `Reprogramado a ${params.fecha} ${params.horaInicio}`,
      },
    });

    return turno;
  });
}
