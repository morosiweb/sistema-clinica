"use client";
import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { fechaClinica } from "@/lib/fecha";
class ErrorSolicitud extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export async function fetchJSON<T>(
  url: string,
  opciones?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...opciones });
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new ErrorSolicitud(
      typeof data?.error === "string"
        ? data.error
        : res.status === 401
          ? "La sesión terminó. Volvé a ingresar."
          : "No se pudo completar la operación.",
      res.status,
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
export function useRecurso<T>(
  url: string | null,
  intervaloMs = 0,
  evento?: string,
) {
  const [revision, refrescar] = useReducer((v: number) => v + 1, 0);
  useEffect(() => {
    if (!evento || !url) return;
    window.addEventListener(evento, refrescar);
    return () => window.removeEventListener(evento, refrescar);
  }, [evento, url]);
  const [estado, setEstado] = useState<{
    url: string;
    revision: number;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let enCurso = false;
    let sinAcceso = false;
    const visible = () =>
      document.visibilityState !== "hidden" && navigator.onLine;
    async function cargar() {
      if (enCurso || sinAcceso || controller.signal.aborted) return;
      clearTimeout(timer);
      enCurso = true;
      try {
        const data = await fetchJSON<T>(url!, { signal: controller.signal });
        if (!controller.signal.aborted)
          setEstado({ url: url!, revision, data });
      } catch (error) {
        if (controller.signal.aborted) return;
        sinAcceso =
          error instanceof ErrorSolicitud && [401, 403].includes(error.status);
        setEstado((anterior) => ({
          url: url!,
          revision,
          // Un fallo temporal no vacía el calendario. Un rechazo de acceso sí.
          data: !sinAcceso && anterior?.url === url ? anterior.data : undefined,
          error: mensajeError(error),
        }));
      } finally {
        enCurso = false;
        if (
          intervaloMs > 0 &&
          !sinAcceso &&
          !controller.signal.aborted &&
          visible()
        )
          timer = setTimeout(cargar, intervaloMs);
      }
    }
    function reanudar() {
      clearTimeout(timer);
      if (visible()) void cargar();
      else if (!navigator.onLine && !sinAcceso)
        setEstado((anterior) =>
          anterior?.url === url && anterior.revision === revision
            ? {
                ...anterior,
                error: "Sin conexión. La agenda se actualizará al reconectar.",
              }
            : anterior,
        );
    }
    void cargar();
    if (intervaloMs > 0) {
      document.addEventListener("visibilitychange", reanudar);
      window.addEventListener("focus", reanudar);
      window.addEventListener("online", reanudar);
      window.addEventListener("offline", reanudar);
    }
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", reanudar);
      window.removeEventListener("focus", reanudar);
      window.removeEventListener("online", reanudar);
      window.removeEventListener("offline", reanudar);
    };
  }, [url, revision, intervaloMs]);
  // Conservar el contenido mientras se actualiza el mismo recurso evita
  // desmontar formularios, perder el foco y mover la agenda al guardar.
  const listo = estado?.url === url;
  return {
    data: listo ? estado.data : undefined,
    error: listo ? estado.error : undefined,
    cargando: !!url && !listo,
    refrescar,
  };
}
export const EVENTO_TURNOS = "clinica:turnos-cambiados";
export function notificarTurnos() {
  window.dispatchEvent(new Event(EVENTO_TURNOS));
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
