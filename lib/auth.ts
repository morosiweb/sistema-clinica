import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const usuario = await prisma.usuarioInterno.findUnique({ where: { email } });
        if (!usuario || !usuario.activo) return null;

        // Bloqueado: no se compara ni la contraseña. Devuelve null igual
        // que usuario inexistente/inactivo/password mal, para no filtrar info.
        if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) return null;

        const valid = await bcrypt.compare(password, usuario.password);
        if (!valid) {
          const intentos = usuario.intentosFallidos + 1;
          await prisma.usuarioInterno.update({
            where: { id: usuario.id },
            data:
              intentos >= MAX_INTENTOS
                ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) }
                : { intentosFallidos: intentos },
          });
          return null;
        }

        if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
          await prisma.usuarioInterno.update({
            where: { id: usuario.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null },
          });
        }

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          medicoId: usuario.medicoId,
        };
      },
    }),
  ],
});
