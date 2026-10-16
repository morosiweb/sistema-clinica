import { Suspense } from "react";
import { redirect } from "next/navigation";
import { authVigente } from "@/lib/sesion";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { pantallasPermitidas, parsePermisos } from "@/lib/pantallas";
import { StaffShell } from "@/components/staff-shell";

export const instant = false;

async function Workspace({ children }: { children: React.ReactNode }) {
  const session = await authVigente();
  if (!session?.user) redirect("/api/auth/sesion-invalida");
  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { nombre: true, rol: true, permisos: true, activo: true },
  });
  if (!usuario?.activo) redirect("/api/auth/sesion-invalida");
  async function salir() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <StaffShell
      nombre={usuario.nombre}
      rol={usuario.rol}
      pantallas={pantallasPermitidas(
        parsePermisos(usuario.permisos),
        usuario.rol,
      )}
      salir={salir}
    >
      {children}
    </StaffShell>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="workspace-loading" role="status">
          Preparando tu espacio…
        </div>
      }
    >
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}
