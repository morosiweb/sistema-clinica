"use client";
import { useState } from "react";
import { useRecurso } from "@/lib/cliente";
const campos: Record<string, string> = {
  dni: "DNI",
  nombre: "Nombre",
  apellido: "Apellido",
  telefono: "Teléfono",
  email: "Email",
  fechaNacimiento: "Fecha de nacimiento",
  obraSocial: "Obra social",
};
export function DatosPacienteRevisiones({
  pacienteId,
}: {
  pacienteId: string;
}) {
  const [abierto, setAbierto] = useState(false),
    [pagina, setPagina] = useState(1);
  const recurso = useRecurso<
    {
      id: string;
      autor: string;
      fecha: string;
      anterior: Record<string, string | null>;
      posterior: Record<string, string | null>;
    }[]
  >(
    abierto
      ? `/api/pacientes/${pacienteId}/datos-revisiones?pagina=${pagina}`
      : null,
  );
  return (
    <section className="surface p-5 mt-5 space-y-3">
      <button
        type="button"
        className="text-link"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        Historial de cambios de datos personales
      </button>
      {abierto && (
        <>
          {recurso.cargando && <p>Cargando cambios…</p>}
          {recurso.error && <p role="alert">{recurso.error}</p>}
          {recurso.data?.length === 0 && (
            <p>Todavía no hay cambios registrados.</p>
          )}
          {recurso.data?.map((r) => (
            <article key={r.id} className="patient-note">
              <p className="text-sm">
                {r.autor} · {new Date(r.fecha).toLocaleString("es-AR")}
              </p>
              {Object.keys(campos)
                .filter((c) => r.anterior[c] !== r.posterior[c])
                .map((c) => (
                  <p key={c}>
                    <strong>{campos[c]}:</strong> {r.anterior[c] || "Sin dato"}{" "}
                    → {r.posterior[c] || "Sin dato"}
                  </p>
                ))}
            </article>
          ))}
          <div className="flex gap-3">
            <button
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Más recientes
            </button>
            <button
              disabled={recurso.data?.length !== 25}
              onClick={() => setPagina((p) => p + 1)}
            >
              Anteriores
            </button>
          </div>
        </>
      )}
    </section>
  );
}
