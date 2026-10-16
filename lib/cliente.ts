"use client";
import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { fechaClinica } from "@/lib/fecha";
export async function fetchJSON<T>(
  url: string,
  opciones?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...opciones });
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : res.status === 401
          ? "La sesión terminó. Volvé a ingresar."
          : "No se pudo completar la operación.",
    );
  if (data === null)
    throw new Error("El servidor devolvió una respuesta inválida.");
  return data as T;
}
export function mensajeError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No se pudo conectar. Intentá nuevamente.";
}
export function useRecurso<T>(url: string | null) {
  const [revision, refrescar] = useReducer((v: number) => v + 1, 0);
  const [estado, setEstado] = useState<{
    url: string;
    revision: number;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetchJSON<T>(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setEstado({ url, revision, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setEstado({ url, revision, error: mensajeError(error) });
      });
    return () => controller.abort();
  }, [url, revision]);
  const listo = estado?.url === url && estado.revision === revision;
  return {
    data: listo ? estado.data : undefined,
    error: listo ? estado.error : undefined,
    cargando: !!url && !listo,
    refrescar,
  };
}
const suscribirFecha = (listener: () => void) => {
  const id = setInterval(listener, 60000);
  return () => clearInterval(id);
};
export function useHoy() {
  return useSyncExternalStore(
    suscribirFecha,
    () => fechaClinica(),
    () => "",
  );
}

const suscribirReloj = (listener: () => void) => {
  const id = setInterval(listener, 30000);
  return () => clearInterval(id);
};
const minutoActual = () => Math.floor(Date.now() / 30000) * 30000;
export function useAhora() {
  return useSyncExternalStore(suscribirReloj, minutoActual, () => 0);
}
