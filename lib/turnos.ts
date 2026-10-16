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
