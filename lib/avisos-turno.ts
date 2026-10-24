import { prisma } from "@/lib/prisma";
import type { Transaccion } from "@/lib/transaccion";
import { desencriptarToken } from "@/lib/token";
import {
  enviarSolicitudTurno,
  enviarConfirmacionTurno,
  enviarCancelacionTurno,
  enviarCambioTurno,
} from "@/lib/notificaciones";
import { ESTADOS_RESERVADOS } from "@/lib/estados-turno";

export type TipoAviso =
  "SOLICITUD" | "CONFIRMACION" | "CANCELACION" | "REPROGRAMACION";
export function programarAviso(
  tx: Transaccion,
  turno: { id: string; fecha: Date; horaInicio: string; medicoId: string },
  tipo: TipoAviso,
) {
  return tx.avisoTurno.create({
    data: {
      turnoId: turno.id,
      fecha: turno.fecha,
      horaInicio: turno.horaInicio,
      medicoId: turno.medicoId,
      tipo,
    },
  });
}

export async function procesarAvisosTurno(ids?: string[]) {
  const candidatos = await prisma.avisoTurno.findMany({
    where: {
      enviado: false,
      descartado: false,
      ...(ids ? { id: { in: ids } } : {}),
    },
    select: { id: true },
    orderBy: [
      { intentadoEl: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
    take: 100,
  });
  const limiteTiempo = Date.now() + 25000;
  let enviados = 0,
    fallidos = 0,
    siguiente = 0;
  async function trabajar() {
    while (siguiente < candidatos.length && Date.now() < limiteTiempo) {
      const { id } = candidatos[siguiente++];
      try {
        const resultado = await prisma.$transaction(
          async (tx) => {
            const [lock] = await tx.$queryRaw<
              { obtenido: boolean }[]
            >`SELECT pg_try_advisory_xact_lock(hashtext(${`aviso:${id}`})) AS obtenido`;
            if (!lock?.obtenido) return null;
            const aviso = await tx.avisoTurno.findUnique({
              where: { id },
              include: {
                turno: {
                  include: {
                    paciente: true,
                    medico: { include: { especialidad: true } },
                  },
                },
              },
            });
            if (!aviso || aviso.enviado || aviso.descartado) return null;
            const t = aviso.turno;
            const coincide =
              t.fecha.getTime() === aviso.fecha.getTime() &&
              t.horaInicio === aviso.horaInicio &&
              t.medicoId === aviso.medicoId;
            const vigente =
              coincide &&
              (aviso.tipo === "SOLICITUD"
                ? t.estado === "PENDIENTE"
                : aviso.tipo === "CANCELACION"
                  ? t.estado === "CANCELADO" && !t.requiereReprogramacion
                  : ESTADOS_RESERVADOS.filter((e) => e !== "PENDIENTE").some(
                      (e) => e === t.estado,
                    ));
            if (!vigente) {
              await tx.avisoTurno.update({
                where: { id },
                data: { descartado: true, error: null },
              });
              return null;
            }
            let resultado = {
              enviado: false,
              canal: null as "whatsapp" | "email" | null,
            };
            try {
              const enviar =
                aviso.tipo === "SOLICITUD"
                  ? enviarSolicitudTurno
                  : aviso.tipo === "CONFIRMACION"
                    ? enviarConfirmacionTurno
                    : aviso.tipo === "REPROGRAMACION"
                      ? enviarCambioTurno
                      : enviarCancelacionTurno;
              resultado = await enviar({
                email: t.paciente.email,
                telefono: t.paciente.telefono,
                nombrePaciente: t.paciente.nombre,
                fecha: t.fecha.toISOString(),
                horaInicio: t.horaInicio,
                medicoNombre: `${t.medico.nombre} ${t.medico.apellido}`,
                especialidad: t.medico.especialidad.nombre,
                token: desencriptarToken(t.paciente.tokenAccesoEnc),
                claveEnvio: `turno/${id}`,
              });
            } catch {
              /* El aviso sigue pendiente sin registrar destinatarios ni contenido. */
            }
            await tx.avisoTurno.update({
              where: { id },
              data: {
                enviado: resultado.enviado,
                canal: resultado.canal,
                intentadoEl: new Date(),
                intentos: { increment: 1 },
                error: resultado.enviado
                  ? null
                  : "No se pudo enviar el aviso. Revisá el contacto o reintentá.",
              },
            });
            return resultado.enviado;
          },
          { timeout: 25000 },
        );
        if (resultado === true) enviados++;
        else if (resultado === false) fallidos++;
      } catch {
        fallidos++;
        console.error("[avisos-turno] Un aviso permanece pendiente");
      }
    }
  }
  await Promise.all([trabajar(), trabajar(), trabajar()]);
  return { revisados: candidatos.length, enviados, fallidos };
}

export async function resultadoAviso(id: string) {
  await procesarAvisosTurno([id]);
  const aviso = await prisma.avisoTurno.findUnique({
    where: { id },
    select: { enviado: true, canal: true },
  });
  return {
    enviado: aviso?.enviado ?? false,
    canal:
      aviso?.canal === "email" || aviso?.canal === "whatsapp"
        ? aviso.canal
        : null,
  };
}
