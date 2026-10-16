import { prisma } from "@/lib/prisma";
import { enviarRecordatorioTurno } from "@/lib/notificaciones";

// El plan Hobby de Vercel solo permite cron jobs de ejecucion diaria, asi
// que el recordatorio usa la ventana de 24-48hs completa (no una ventana
// angosta que dependa de una frecuencia horaria).
const HORAS_ANTICIPACION_MIN = 24;
const HORAS_ANTICIPACION_MAX = 48;

function fechaHoraTurno(fecha: Date, horaInicio: string): Date {
  const [h, m] = horaInicio.split(":").map(Number);
  const dt = new Date(fecha);
  dt.setUTCHours(h, m, 0, 0);
  return dt;
}

// Busca turnos de hoy/mañana/pasado (PENDIENTE o CONFIRMADO, sin recordatorio
// previo) y manda el recordatorio a los que caen en la ventana de 24-48hs.
// Pensado para correr una vez por dia via cron de Vercel.
export async function procesarRecordatorios() {
  const ahora = new Date();
  const desde = new Date(ahora);
  desde.setUTCDate(desde.getUTCDate() - 1);
  const hasta = new Date(ahora);
  hasta.setUTCDate(hasta.getUTCDate() + 3);

  const candidatos = await prisma.turno.findMany({
    where: {
      estado: { in: ["PENDIENTE", "CONFIRMADO"] },
      recordatorioEnviado: false,
      fecha: { gte: desde, lte: hasta },
    },
    include: {
      paciente: { select: { email: true, nombre: true } },
      medico: { include: { especialidad: true } },
    },
  });

  let enviados = 0;
  for (const turno of candidatos) {
    const inicio = fechaHoraTurno(turno.fecha, turno.horaInicio);
    const horasRestantes = (inicio.getTime() - ahora.getTime()) / (1000 * 60 * 60);
    const enVentana = horasRestantes >= HORAS_ANTICIPACION_MIN && horasRestantes < HORAS_ANTICIPACION_MAX;
    if (!enVentana) continue;

    await enviarRecordatorioTurno({
      email: turno.paciente.email,
      nombrePaciente: turno.paciente.nombre,
      fecha: turno.fecha.toISOString(),
      horaInicio: turno.horaInicio,
      medicoNombre: `${turno.medico.nombre} ${turno.medico.apellido}`,
      especialidad: turno.medico.especialidad.nombre,
    });
    await prisma.turno.update({ where: { id: turno.id }, data: { recordatorioEnviado: true } });
    enviados++;
  }

  return { revisados: candidatos.length, enviados };
}
