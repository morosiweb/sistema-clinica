import { prisma } from "@/lib/prisma";
import { enviarRecordatorioTurno } from "@/lib/notificaciones";
import { instanteClinica, fechaClinica, fechaDB, sumarDias } from "@/lib/fecha";
import { desencriptarToken } from "@/lib/token";

export async function procesarRecordatorios() {
  const hoy = fechaClinica();
  const candidatos = await prisma.turno.findMany({
    where: {
      estado: { in: ["PENDIENTE", "CONFIRMADO"] },
      recordatorioEnviado: false,
      fecha: { gte: fechaDB(hoy), lte: fechaDB(sumarDias(hoy, 2)) },
    },
    select: { id: true },
  });
  let enviados = 0,
    fallidos = 0;
  for (const candidato of candidatos) {
    try {
      const resultado = await prisma.$transaction(
        async (tx) => {
          // Dos ejecuciones de cron no envían simultáneamente el mismo turno.
          const [bloqueo] = await tx.$queryRaw<
            { obtenido: boolean }[]
          >`SELECT pg_try_advisory_xact_lock(hashtext(${`recordatorio:${candidato.id}`})) AS obtenido`;
          if (!bloqueo?.obtenido) return "omitido";
          const turno = await tx.turno.findUnique({
            where: { id: candidato.id },
            include: {
              paciente: {
                select: {
                  email: true,
                  telefono: true,
                  nombre: true,
                  tokenAccesoEnc: true,
                },
              },
              medico: { include: { especialidad: true } },
            },
          });
          if (
            !turno ||
            turno.recordatorioEnviado ||
            !["PENDIENTE", "CONFIRMADO"].includes(turno.estado)
          )
            return "omitido";
          const horas =
            (instanteClinica(turno.fecha, turno.horaInicio).getTime() -
              Date.now()) /
            3600000;
          // También reintenta fallos y contempla reservas recientes a menos de 24 h.
          if (horas <= 0 || horas >= 48) return "omitido";
          const { enviado } = await enviarRecordatorioTurno({
            email: turno.paciente.email,
            telefono: turno.paciente.telefono,
            nombrePaciente: turno.paciente.nombre,
            fecha: turno.fecha.toISOString(),
            horaInicio: turno.horaInicio,
            medicoNombre: `${turno.medico.nombre} ${turno.medico.apellido}`,
            especialidad: turno.medico.especialidad.nombre,
            token: desencriptarToken(turno.paciente.tokenAccesoEnc),
            claveEnvio: `recordatorio/${turno.id}/${turno.fecha.toISOString().slice(0, 10)}/${turno.horaInicio}/${turno.medicoId}`,
          });
          const cambio = await tx.turno.updateMany({
            where: {
              id: turno.id,
              version: turno.version,
              recordatorioEnviado: false,
            },
            data: {
              recordatorioEnviado: enviado,
              recordatorioIntentadoEl: new Date(),
              recordatorioError: enviado ? null : "No se pudo enviar el aviso",
            },
          });
          return cambio.count ? (enviado ? "enviado" : "fallido") : "omitido";
        },
        { timeout: 20000 },
      );
      if (resultado === "enviado") enviados++;
      if (resultado === "fallido") fallidos++;
    } catch {
      fallidos++;
      console.error(
        "[recordatorios] Falló un turno; se continúa con los siguientes",
      );
    }
  }
  const vencido = new Date(Date.now() - 86400000);
  await prisma.verificacionPaciente.deleteMany({
    where: { venceEl: { lt: vencido } },
  });
  await prisma.limiteSolicitud.deleteMany({
    where: { venceEl: { lt: vencido } },
  });
  return { revisados: candidatos.length, enviados, fallidos };
}
