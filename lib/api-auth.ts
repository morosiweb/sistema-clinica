import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, puedeVer } from "@/lib/pantallas";

// La sesión es JWT y no se revalida sola: desactivar un usuario o cambiarle
// el rol/permisos no corta su sesión existente. Por eso en cada request de
// API se relee activo/rol/permisos frescos desde la base.
async function sesionVigente(claves?: readonly string[]) {
  const session = await auth();
  if (!session?.user) return null;

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { activo: true, rol: true, medicoId: true, permisos: true },
  });
  if (!usuario || !usuario.activo) return null;

  session.user.rol = usuario.rol;
  session.user.medicoId = usuario.medicoId;

  if (
    claves &&
    !puedeVer(parsePermisos(usuario.permisos), usuario.rol, claves)
  ) {
    return "sin-acceso" as const;
  }
  return session;
}

export async function requireSession(claves?: readonly string[]) {
  const session = await sesionVigente(claves);
  if (session === null) {
    return {
      session: null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  if (session === "sin-acceso") {
    return {
      session: null,
      response: NextResponse.json({ error: "Sin acceso" }, { status: 403 }),
    };
  }
  return { session, response: null };
}

export async function requireAdmin() {
  const session = await sesionVigente();
  if (session === null || session === "sin-acceso") {
    return {
      session: null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  if (session.user.rol !== "ADMIN") {
    return {
      session: null,
      response: NextResponse.json({ error: "Sin acceso" }, { status: 403 }),
    };
  }
  return { session, response: null };
}
