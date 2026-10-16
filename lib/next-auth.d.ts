import { DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
  interface User {
    rol?: "ADMIN" | "SECRETARIA" | "MEDICO";
    medicoId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      rol: "ADMIN" | "SECRETARIA" | "MEDICO";
      medicoId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    rol: "ADMIN" | "SECRETARIA" | "MEDICO";
    medicoId: string | null;
  }
}
