import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isOnLogin = pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", request.nextUrl));
        return true;
      }
      // Las rutas /api se dejan pasar: se protegen solas con
      // requireSession/requireAdmin (lib/api-auth.ts) y devuelven 401/403 JSON.
      if (pathname.startsWith("/api")) return true;

      if (!isLoggedIn) return false;

      if (pathname.startsWith("/admin") && auth?.user?.rol !== "ADMIN") {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.rol = user.rol as "ADMIN" | "SECRETARIA" | "MEDICO";
        token.medicoId = (user.medicoId as string | null) ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.rol = token.rol;
        session.user.medicoId = token.medicoId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
