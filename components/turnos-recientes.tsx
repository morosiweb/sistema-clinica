"use client";
import Link from "next/link";
import { EstadoBadge } from "@/components/estado-badge";
import { EVENTO_TURNOS, useRecurso } from "@/lib/cliente";

type TurnoReciente = {
  id: string;
  fecha: string;
  horaInicio: string;
  estado: string;
  paciente: { nombre: string; apellido: string };
  medico: { apellido: string };
};

export function TurnosRecientes() {
  const recurso = useRecurso<TurnoReciente[]>(
    "/api/turnos/recientes",
    5000,
    EVENTO_TURNOS,
  );
  if (recurso.error && !recurso.data)
    return (
      <p role="alert" className="notice notice-error">
        {recurso.error}
      </p>
    );
  if (!recurso.data?.length) return null;
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-medium text-neutral-500">
        Últimos turnos reservados
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recurso.data.map((t) => (
          <Link
            key={t.id}
            href={`/turnos/${t.id}`}
            className="shrink-0 rounded-md border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <p className="font-medium">
              {t.paciente.apellido}, {t.paciente.nombre}
            </p>
            <p className="text-neutral-500">
              {new Date(t.fecha).toLocaleDateString("es-AR", {
                timeZone: "UTC",
              })}{" "}
              · {t.horaInicio} · {t.medico.apellido}
            </p>
            <EstadoBadge estado={t.estado} />
          </Link>
        ))}
      </div>
    </div>
  );
}
