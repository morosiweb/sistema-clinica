import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reservaPublicaSchema } from "@/lib/validations/publico";
import { crearTokenAcceso } from "@/lib/pacientes";
import { crearTurnoEnTx } from "@/lib/turnos";
import { transaccionAgenda } from "@/lib/transaccion";
import {
  comprobarCodigo,
  ERROR_CODIGO,
  limitarSolicitud,
  origenSolicitud,
} from "@/lib/verificacion";
import { desencriptarToken } from "@/lib/token";
import { resultadoAviso } from "@/lib/avisos-turno";
import { ErrorClinica } from "@/lib/errores";
import { fechaDB, fechaClinica } from "@/lib/fecha";
export const maxDuration = 60;

async function POSTHandler(request: NextRequest) {
  const data = reservaPublicaSchema.parse(await request.json());
  await limitarSolicitud(`reservar:${origenSolicitud(request)}`, 20);
  const resultado = await transaccionAgenda(async (tx) => {
    const codigo = await comprobarCodigo(
      tx,
      data.verificacionId,
      data.codigo,
      "RESERVA",
    );
    if (
      !codigo ||
      codigo.dni !== data.dni ||
      (!codigo.pacienteId && codigo.email !== data.email)
    )
      return null;
    let paciente = codigo.pacienteId
      ? await tx.paciente.findUniqueOrThrow({
          where: { id: codigo.pacienteId },
        })
      : null;
    if (!paciente) {
      const acceso = crearTokenAcceso();
      paciente = await tx.paciente.create({
        data: {
          dni: data.dni,
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono,
          email: codigo.email,
          tokenAccesoHash: acceso.tokenAccesoHash,
          tokenAccesoEnc: acceso.tokenAccesoEnc,
        },
      });
    }
    const pendientes = await tx.turno.count({
      where: {
        pacienteId: paciente.id,
        fecha: { gte: fechaDB(fechaClinica()) },
        estado: {
          in: ["PENDIENTE", "CONFIRMADO", "LLEGO", "EN_ESPERA", "EN_CONSULTA"],
        },
      },
    });
    if (pendientes >= 5)
      throw new ErrorClinica(
        "Ya tenés cinco turnos próximos. Para reservar otro, comunicate con secretaría.",
        409,
      );
    const turno = await crearTurnoEnTx(tx, {
      ...data,
      pacienteId: paciente.id,
      canalReserva: "ONLINE",
      realizadoPor: `paciente:${paciente.id}`,
    });
    await tx.verificacionPaciente.update({
      where: { id: codigo.id },
      data: { consumidoEl: new Date() },
    });
    return {
      turno,
      paciente,
      token: desencriptarToken(paciente.tokenAccesoEnc),
    };
  });
  if (!resultado)
    return NextResponse.json({ error: ERROR_CODIGO }, { status: 400 });
  const { turno, token } = resultado;
  const aviso = await prisma.avisoTurno.findFirstOrThrow({
    where: { turnoId: turno.id, tipo: "SOLICITUD" },
    orderBy: { createdAt: "desc" },
  });
  const notificacion = await resultadoAviso(aviso.id);
  return NextResponse.json(
    {
      turno: { id: turno.id },
      linkAcceso: `/mi-turno/${token}`,
      notificacion,
    },
    { status: 201 },
  );
}

export const POST = conErrores(POSTHandler);
