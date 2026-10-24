import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generarToken, hashToken } from "@/lib/token";
import { enviar, escaparHTML } from "@/lib/notificaciones";
import { ErrorClinica } from "@/lib/errores";

export async function cambiarClave(
  usuarioId: string,
  versionSesion: number,
  actual: string,
  nueva: string,
) {
  const hash = await bcrypt.hash(nueva, 10);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cuenta:${usuarioId}`}))`;
    const usuario = await tx.usuarioInterno.findUniqueOrThrow({
      where: { id: usuarioId },
    });
    if (!usuario.activo || usuario.versionSesion !== versionSesion)
      throw new ErrorClinica("La sesión terminó. Volvé a ingresar.", 401);
    if (!(await bcrypt.compare(actual, usuario.password)))
      throw new ErrorClinica("La contraseña actual no es correcta", 400);
    if (await bcrypt.compare(nueva, usuario.password))
      throw new ErrorClinica("Elegí una contraseña diferente a la actual");
    await tx.usuarioInterno.update({
      where: { id: usuarioId, versionSesion },
      data: {
        password: hash,
        versionSesion: { increment: 1 },
        bloqueadoHasta: null,
        intentosFallidos: 0,
      },
    });
  });
}

export async function solicitarRecuperacion(email: string) {
  const usuarios = await prisma.usuarioInterno.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, versionSesion: true, activo: true },
    take: 2,
  });
  if (usuarios.length !== 1 || !usuarios[0].activo) return;
  const usuario = usuarios[0];
  const token = generarToken();
  await prisma.recuperacionCuenta.create({
    data: {
      tokenHash: hashToken(token),
      usuarioId: usuario.id,
      versionSesion: usuario.versionSesion,
      venceEl: new Date(Date.now() + 30 * 60000),
    },
  });
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (!base) return;
  const link = `${base}/login/restablecer?token=${token}`;
  await enviar(
    usuario.email,
    "Restablecer tu contraseña del panel",
    `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta del personal.</p><p><a href="${escaparHTML(link)}">Elegir una nueva contraseña</a></p><p>El enlace vence en 30 minutos y se puede usar una sola vez. Si no lo pediste, ignorá este mensaje.</p>`,
    `Elegí una nueva contraseña desde ${link}\nEl enlace vence en 30 minutos. Si no lo pediste, ignorá este mensaje.`,
  );
}

export async function restablecerClave(token: string, nueva: string) {
  const tokenHash = hashToken(token),
    hash = await bcrypt.hash(nueva, 10);
  await prisma.$transaction(async (tx) => {
    const recuperacion = await tx.recuperacionCuenta.findUnique({
      where: { tokenHash },
    });
    if (!recuperacion)
      throw new ErrorClinica(
        "El enlace es inválido o venció. Solicitá uno nuevo.",
        400,
      );
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cuenta:${recuperacion.usuarioId}`}))`;
    const dato = await tx.recuperacionCuenta.findUniqueOrThrow({
      where: { tokenHash },
      include: { usuario: true },
    });
    if (
      dato.consumidoEl ||
      dato.venceEl <= new Date() ||
      !dato.usuario.activo ||
      dato.versionSesion !== dato.usuario.versionSesion
    )
      throw new ErrorClinica(
        "El enlace es inválido o venció. Solicitá uno nuevo.",
        400,
      );
    await tx.recuperacionCuenta.update({
      where: { tokenHash },
      data: { consumidoEl: new Date() },
    });
    await tx.usuarioInterno.update({
      where: { id: dato.usuarioId, versionSesion: dato.versionSesion },
      data: {
        password: hash,
        versionSesion: { increment: 1 },
        bloqueadoHasta: null,
        intentosFallidos: 0,
      },
    });
  });
}
