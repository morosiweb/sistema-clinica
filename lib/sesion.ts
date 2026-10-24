import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

// Las páginas y las API consultan el estado actual: un JWT emitido antes de
// una baja o cambio de rol no conserva acceso a información interna.
export async function authVigente() {
  // Auth.js genera valores criptográficos: la sesión debe resolverse durante
  // la petición, también cuando Next prepara una página con Cache Components.
  await connection();
  const session = await auth();
  if (!session?.user) return null;
  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: {
      activo: true,
      versionSesion: true,
      rol: true,
      medicoId: true,
      nombre: true,
      email: true,
    },
  });
  if (
    !usuario?.activo ||
    usuario.versionSesion !== (session.user.versionSesion ?? 0)
  )
    return null;
  return {
    ...session,
    user: {
      ...session.user,
      rol: usuario.rol,
      medicoId: usuario.medicoId,
      name: usuario.nombre,
      email: usuario.email,
    },
  };
}
