import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePermisos, pantallasPermitidas } from "@/lib/pantallas";

// Depende de la sesión (cookies) en cada request, no se puede prerenderizar.
export const instant = false;

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuario = await prisma.usuarioInterno.findUnique({
    where: { id: session.user.id },
    select: { nombre: true, rol: true, permisos: true, activo: true },
  });
  // El JWT puede seguir "vigente" aunque el usuario haya sido borrado o
  // desactivado después de emitido: hay que limpiar la cookie, no solo
  // redirigir, o /login rebota de nuevo para acá (loop infinito).
  if (!usuario || !usuario.activo) redirect("/api/auth/sesion-invalida");

  const pantallas = pantallasPermitidas(parsePermisos(usuario.permisos), usuario.rol);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sistema Clínica</h1>
          <p className="text-sm text-neutral-500">
            {usuario.nombre} · {usuario.rol}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm text-neutral-500 underline">
            Salir
          </button>
        </form>
      </header>

      <nav className="grid gap-2">
        {pantallas.map((p) => (
          <a
            key={p.key}
            href={p.href}
            className="rounded-md border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            {p.label}
          </a>
        ))}
        {pantallas.length === 0 && (
          <p className="text-sm text-neutral-500">No tenés pantallas habilitadas todavía.</p>
        )}
      </nav>
    </div>
  );
}
