import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generarToken, hashToken } from "@/lib/token";
import {
  correoConfigurado,
  whatsappConfigurado,
  enviarCodigo,
} from "@/lib/notificaciones";
import { ErrorClinica } from "@/lib/errores";
import type { Transaccion } from "@/lib/transaccion";

export const MENSAJE_CODIGO =
  "Si los datos permiten gestionar turnos online, enviamos un código al email registrado. Si no lo recibís, comunicate con secretaría.";
const DURACION = 10 * 60 * 1000;

function hashCodigo(id: string, codigo: string) {
  const clave = process.env.NEXTAUTH_SECRET || process.env.TOKEN_ENCRYPTION_KEY;
  if (!clave) throw new Error("Falta la clave de verificación");
  return crypto
    .createHmac("sha256", clave)
    .update(`${id}:${codigo}`)
    .digest("hex");
}

// Persistente: funciona entre varias instancias y conserva límites tras un reinicio.
export async function limitarSolicitud(
  ambito: string,
  maximo: number,
  ventanaMs = DURACION,
) {
  const ventana = Math.floor(Date.now() / ventanaMs);
  const clave = hashToken(`${ambito}:${ventana}`);
  const limite = await prisma.limiteSolicitud.upsert({
    where: { clave },
    create: { clave, venceEl: new Date((ventana + 1) * ventanaMs) },
    update: { cantidad: { increment: 1 } },
  });
  if (limite.cantidad > maximo)
    throw new ErrorClinica(
      "Demasiadas solicitudes. Esperá unos minutos antes de intentar nuevamente.",
      429,
    );
}

export function origenSolicitud(request: Request) {
  // El proxy de despliegue debe reemplazar estos encabezados (ver README).
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "sin-ip"
  );
}

export async function solicitarCodigo(
  dni: string,
  email: string | undefined,
  proposito: "RESERVA" | "ACCESO",
  origen: string,
) {
  if (!correoConfigurado() && !whatsappConfigurado())
    throw new ErrorClinica(
      "La gestión online no está disponible. Comunicate con la clínica.",
      503,
    );
  await limitarSolicitud(`codigo:ip:${origen}`, 20);
  await limitarSolicitud(`codigo:dni:${dni}`, 3);
  const paciente = await prisma.paciente.findUnique({ where: { dni } });
  // Un DNI existente SIEMPRE usa el contacto de la clínica. Nunca el enviado
  // por el visitante. Sin contacto, se conserva la respuesta genérica.
  const destino = paciente
    ? paciente.email?.trim().toLowerCase() || null
    : proposito === "RESERVA"
      ? email || null
      : null;
  // El teléfono de un DNI nuevo todavía no se conoce en este paso (recién se
  // envía junto con la reserva), así que ese primer código siempre va por
  // email. Para un paciente ya existente sí hay teléfono disponible.
  const telefono = paciente?.telefono || null;
  const id = generarToken();
  const codigo = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  await prisma.verificacionPaciente.create({
    data: {
      id,
      dni,
      pacienteId: paciente?.id || null,
      email: destino,
      telefono,
      proposito,
      codigoHash: hashCodigo(id, codigo),
      venceEl: new Date(Date.now() + DURACION),
    },
  });
  if (destino || telefono) {
    const { enviado } = await enviarCodigo({ email: destino, telefono }, codigo);
    if (!enviado) {
      await prisma.verificacionPaciente.update({
        where: { id },
        data: { consumidoEl: new Date() },
      });
      throw new ErrorClinica(
        "No pudimos enviar el código. Intentá más tarde o comunicate con secretaría.",
        503,
      );
    }
  }
  return { verificacionId: id, mensaje: MENSAJE_CODIGO };
}

// Devuelve null, sin lanzar: el incremento de intentos debe confirmarse incluso
// si el código no coincide. El consumidor marca el uso en la MISMA transacción
// que crea la reserva o entrega el acceso.
export async function comprobarCodigo(
  tx: Transaccion,
  id: string,
  codigo: string,
  proposito: "RESERVA" | "ACCESO",
) {
  const dato = await tx.verificacionPaciente.findUnique({ where: { id } });
  if (
    !dato ||
    dato.proposito !== proposito ||
    dato.consumidoEl ||
    dato.venceEl.getTime() <= Date.now() ||
    dato.intentos >= 5 ||
    (!dato.email && !dato.telefono)
  )
    return null;
  await tx.verificacionPaciente.update({
    where: { id },
    data: { intentos: { increment: 1 } },
  });
  const recibido = Buffer.from(hashCodigo(id, codigo), "hex");
  if (!crypto.timingSafeEqual(recibido, Buffer.from(dato.codigoHash, "hex")))
    return null;
  const paciente = await tx.paciente.findUnique({ where: { dni: dato.dni } });
  // Si secretaría actualizó el contacto, o alguien creó el DNI mientras tanto,
  // el código anterior no acredita acceso a ese registro.
  if (
    dato.pacienteId
      ? !paciente ||
        paciente.id !== dato.pacienteId ||
        (paciente.email?.trim().toLowerCase() ?? null) !== dato.email ||
        (paciente.telefono ?? null) !== dato.telefono
      : !!paciente
  )
    return null;
  return dato;
}

export const ERROR_CODIGO =
  "Código inválido, vencido o ya utilizado. Solicitá uno nuevo si es necesario.";
