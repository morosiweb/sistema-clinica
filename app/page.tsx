import Link from "next/link";
import { redirect } from "next/navigation";
import { authVigente as auth } from "@/lib/sesion";

export const instant = false;

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/panel");

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-neutral-950">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold">Sistema Clínica</span>
        <Link href="/login" className="text-sm text-neutral-500 underline">
          Acceso del personal
        </Link>
      </header>

      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Sacá tu turno en un par de clicks
        </h1>
        <p className="mt-4 max-w-md text-neutral-500">
          Elegí el médico, el día y el horario que te quede mejor. Sin esperar
          al teléfono, sin registrarte.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/reservar"
            className="rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Quiero un turno
          </Link>
          <Link
            href="/mi-turno/recuperar"
            className="rounded-full border border-neutral-300 px-8 py-3 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Ya tengo un turno
          </Link>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-neutral-400">
        Sistema Clínica
      </footer>
    </div>
  );
}
