"use client";
import { useEffect, useRef, useState } from "react";
import { fetchJSON, mensajeError } from "@/lib/cliente";
type Borrador<T> = {
  id: string;
  contenido: T;
  versionBase: number;
  revision: number;
  updatedAt: string;
};
export function useBorradorClinico<T extends Record<string, string>>(
  tipo: "nota" | "ficha" | "visita",
  id: string,
  versionBase: number,
  contenido: T,
  activo: boolean,
  habilitado = true,
) {
  const [disponible, setDisponible] = useState<Borrador<T> | null>(null);
  const [estado, setEstado] = useState("");
  const [listo, setListo] = useState(false);
  const borradorId = useRef<string | null>(null);
  const revision = useRef(0),
    generacion = useRef(0),
    pendiente = useRef<Promise<unknown>>(Promise.resolve());
  const valor = JSON.stringify(contenido),
    base = `/api/borradores/${tipo}/${id}`;
  useEffect(() => {
    if (!habilitado) return;
    const controller = new AbortController();
    const contador = generacion;
    void fetchJSON<{ borrador: Borrador<T> | null }>(base, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        revision.current = data.borrador?.revision ?? 0;
        borradorId.current = data.borrador?.id ?? null;
        setDisponible(data.borrador);
        setListo(true);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setEstado(mensajeError(error));
      });
    return () => {
      controller.abort();
      contador.current++;
    };
  }, [base, habilitado]);
  useEffect(() => {
    if (!listo || !activo) return;
    const gen = generacion.current;
    const timer = setTimeout(() => {
      pendiente.current = pendiente.current
        .catch(() => {})
        .then(async () => {
          if (gen !== generacion.current) return;
          setEstado("Guardando borrador…");
          try {
            const data = await fetchJSON<{ id: string; revision: number }>(
              base,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contenido: JSON.parse(valor),
                  versionBase,
                  revision: revision.current,
                  borradorId: borradorId.current,
                }),
              },
            );
            revision.current = data.revision;
            borradorId.current = data.id;
            setEstado("Borrador privado guardado.");
          } catch (error) {
            setEstado(`No se guardó el borrador: ${mensajeError(error)}`);
          }
        });
    }, 1800);
    return () => clearTimeout(timer);
  }, [base, valor, versionBase, activo, listo]);
  async function limpiar() {
    generacion.current++;
    await pendiente.current.catch(() => {});
    if (revision.current)
      await fetchJSON(base, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: revision.current,
          borradorId: borradorId.current,
        }),
      });
    revision.current = 0;
    borradorId.current = null;
    setDisponible(null);
    setEstado("");
  }
  function restaurar() {
    setDisponible(null);
    return disponible?.contenido;
  }
  return { disponible, estado, limpiar, restaurar };
}
