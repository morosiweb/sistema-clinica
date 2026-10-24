import { prisma } from "@/lib/prisma";
import { enviarReprogramacionPorLicencia } from "@/lib/notificaciones";
import { desencriptarToken } from "@/lib/token";

// La solicitud queda guardada junto con el turno en la misma transacción
// de la licencia. Un fallo del correo nunca pierde el aviso pendiente.
export async function procesarAvisosReprogramacion(
  reprogramacionId?: string,
  limite = 100,
  ids?: string[],
) {
  const candidatos = await prisma.turno.findMany({
    where: {
      requiereReprogramacion: true,
      ...(ids ? { id: { in: ids } } : {}),
      estado: "CANCELADO",
      avisoReprogramacionEnviado: false,
      reprogramacionId: reprogramacionId || { not: null },
    },
    select: { id: true },
    orderBy: [
      { avisoReprogramacionIntentadoEl: { sort: "asc", nulls: "first" } },
      { id: "asc" },
    ],
    take: limite,
  });
  let enviados = 0,
    fallidos = 0,
    sinEmail = 0,
    siguiente = 0;
  async function trabajar() {
    while (siguiente < candidatos.length) {
      const candidato = candidatos[siguiente++];
      try {
        const resultado = await prisma.$transaction(
          async (tx) => {
            const [bloqueo] = await tx.$queryRaw<
              { obtenido: boolean }[]
            >`SELECT pg_try_advisory_xact_lock(hashtext(${`aviso-licencia:${candidato.id}`})) AS obtenido`;
            if (!bloqueo?.obtenido) return "omitido";
            const turno = await tx.turno.findUnique({
              where: { id: candidato.id },
              include: {
                paciente: {
                  select: {
                    nombre: true,
                    email: true,
                    telefono: true,
                    tokenAccesoEnc: true,
                  },
                },
                medico: { include: { especialidad: true } },
              },
            });
            if (
              !turno ||
              !turno.requiereReprogramacion ||
              turno.estado !== "CANCELADO" ||
              turno.avisoReprogramacionEnviado ||
              !turno.reprogramacionId ||
              (reprogramacionId && turno.reprogramacionId !== reprogramacionId)
            )
              return "omitido";
            const tieneContacto =
              !!turno.paciente.email || !!turno.paciente.telefono;
            let enviado = false;
            try {
              if (tieneContacto)
                ({ enviado } = await enviarReprogramacionPorLicencia({
                  email: turno.paciente.email,
                  telefono: turno.paciente.telefono,
                  nombrePaciente: turno.paciente.nombre,
                  fecha: turno.fecha.toISOString(),
                  horaInicio: turno.horaInicio,
                  medicoNombre: `${turno.medico.nombre} ${turno.medico.apellido}`,
                  especialidad: turno.medico.especialidad.nombre,
                  token: desencriptarToken(turno.paciente.tokenAccesoEnc),
                  turnoId: turno.id,
                  claveEnvio: `licencia/${turno.reprogramacionId}/${turno.id}`,
                }));
            } catch {
              // Registrar únicamente un estado genérico; nunca enlaces ni destinatarios.
            }
            const cambio = await tx.turno.updateMany({
              where: {
                id: turno.id,
                reprogramacionId: turno.reprogramacionId,
                requiereReprogramacion: true,
                estado: "CANCELADO",
                avisoReprogramacionEnviado: false,
              },
              data: {
                avisoReprogramacionEnviado: enviado,
                avisoReprogramacionIntentadoEl: new Date(),
                avisoReprogramacionError: enviado
                  ? null
                  : tieneContacto
                    ? "No se pudo enviar el aviso. Se reintentará."
                    : "El paciente no tiene email ni teléfono registrado.",
              },
            });
            return !cambio.count
              ? "omitido"
              : enviado
                ? "enviado"
                : tieneContacto
                  ? "fallido"
                  : "sin-email";
          },
          { timeout: 20000 },
        );
        if (resultado === "enviado") enviados++;
        if (resultado === "fallido") fallidos++;
        if (resultado === "sin-email") sinEmail++;
      } catch {
        fallidos++;
        console.error(
          "[avisos-licencia] No se pudo procesar un aviso; permanece pendiente",
        );
      }
    }
  }
  await Promise.all([trabajar(), trabajar(), trabajar()]);
  return { revisados: candidatos.length, enviados, fallidos, sinEmail };
}
