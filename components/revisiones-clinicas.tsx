"use client";
import { useState } from "react";
import { useRecurso } from "@/lib/cliente";
type Revision = {
  id: string;
  version: number;
  realizadoPor: string;
  fecha: string;
  anterior: unknown;
  posterior: unknown;
};
export function RevisionesClinicas({
  tipo,
  id,
  version,
}: {
  tipo: "ficha" | "notas";
  id: string;
  version: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const base =
    tipo === "ficha"
      ? `/api/pacientes/${id}/revisiones`
      : `/api/turnos/${id}/revisiones`;
  const recurso = useRecurso<Revision[]>(
    abierto ? `${base}?version=${version}` : null,
  );
  return (
    <details onToggle={(e) => setAbierto(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm">
        Revisiones de{" "}
        {tipo === "ficha" ? "la ficha médica" : "las notas clínicas"}
      </summary>
      {recurso.cargando && <p className="text-xs">Cargando…</p>}
      {recurso.error && <p role="alert">{recurso.error}</p>}
      {recurso.data?.map((r) => (
        <article key={r.id} className="mt-2 rounded border p-2 text-xs">
          <p>
            Versión {r.version} · {new Date(r.fecha).toLocaleString("es-AR")} ·{" "}
            {r.realizadoPor}
          </p>
          <p className="mt-1 font-medium">Antes</p>
          <pre className="whitespace-pre-wrap break-words">
            {typeof r.anterior === "string"
              ? r.anterior
              : JSON.stringify(r.anterior, null, 2)}
          </pre>
          <p className="mt-1 font-medium">Después</p>
          <pre className="whitespace-pre-wrap break-words">
            {typeof r.posterior === "string"
              ? r.posterior
              : JSON.stringify(r.posterior, null, 2)}
          </pre>
        </article>
      ))}
      {recurso.data?.length === 0 && (
        <p className="text-xs">Sin revisiones registradas.</p>
      )}
    </details>
  );
}
