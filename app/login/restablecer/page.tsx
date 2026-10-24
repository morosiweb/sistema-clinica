import { Suspense } from "react";
import { RestablecerCuentaForm } from "@/components/cuenta-clave";
export default function RestablecerPage() {
  return (
    <Suspense fallback={<p>Cargando recuperación…</p>}>
      <RestablecerCuentaForm />
    </Suspense>
  );
}
