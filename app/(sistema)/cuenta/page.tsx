import { redirect } from "next/navigation";
import { authVigente } from "@/lib/sesion";
import { CambiarClaveForm } from "@/components/cuenta-clave";
export const instant = false;
export default async function CuentaPage() {
  const session = await authVigente();
  if (!session) redirect("/api/auth/sesion-invalida");
  return (
    <div className="record-page">
      <h1 className="mb-6 text-xl font-semibold">Mi cuenta</h1>
      <CambiarClaveForm
        nombre={session.user.name ?? "Personal de la clínica"}
        email={session.user.email ?? ""}
      />
    </div>
  );
}
