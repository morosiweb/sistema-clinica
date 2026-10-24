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
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials?.password !== "string"
        )
          return null;
        const email = credentials.email.trim().toLowerCase(),
          password = credentials.password;
        if (!email || email.length > 254 || !password || password.length > 200)
          return null;
        return prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`login:${email}`}))`;
          // Permite iniciar sesión con emails antiguos sin normalizar. Si hay
          // duplicados ambiguos, se rechaza hasta que un admin los resuelva.
          const usuarios = await tx.usuarioInterno.findMany({
            where: { email: { equals: email, mode: "insensitive" } },
            take: 2,
          });
          if (usuarios.length !== 1 || !usuarios[0].activo) return null;
          const usuario = usuarios[0];
          if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date())
            return null;
          const valid = await bcrypt.compare(password, usuario.password);
          if (!valid) {
            const intentos = usuario.intentosFallidos + 1;
            await tx.usuarioInterno.update({
              where: { id: usuario.id },
              data:
                intentos >= MAX_INTENTOS
                  ? {
                      intentosFallidos: 0,
                      bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS),
                    }
                  : { intentosFallidos: intentos },
            });
            return null;
          }
          await tx.usuarioInterno.update({
            where: { id: usuario.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null },
          });
          return {
            id: usuario.id,
            name: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            medicoId: usuario.medicoId,
            versionSesion: usuario.versionSesion,
          };
        });
      },
    }),
  ],
});
