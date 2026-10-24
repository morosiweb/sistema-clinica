"use client";
import { useEffect, useRef } from "react";
const cambios = new Set<symbol>();
let usuarios = 0;
let ubicacion: { href: string; state: unknown } | null = null;
export function confirmarSalida() {
  return (
    cambios.size === 0 ||
    window.confirm(
      "Tenés cambios sin guardar. ¿Querés salir de todas maneras? Los borradores guardados se conservan para tu próxima visita.",
    )
  );
}
function cerrar(event: BeforeUnloadEvent) {
  if (cambios.size) {
    event.preventDefault();
    event.returnValue = "";
  }
}
function volver(event: PopStateEvent) {
  if (
    cambios.size &&
    ubicacion &&
    window.location.href !== ubicacion.href &&
    !confirmarSalida()
  ) {
    event.stopImmediatePropagation();
    window.history.pushState(ubicacion.state, "", ubicacion.href);
  }
}
function navegar(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = (event.target as Element)?.closest?.(
    "a[href]",
  ) as HTMLAnchorElement | null;
  if (
    !link ||
    link.target === "_blank" ||
    link.hasAttribute("download") ||
    !/^https?:/.test(link.href)
  )
    return;
  const siguiente = new URL(link.href),
    actual = new URL(window.location.href);
  if (
    siguiente.pathname === actual.pathname &&
    siguiente.search === actual.search &&
    siguiente.origin === actual.origin
  )
    return;
  if (!confirmarSalida()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
export function useCambiosSinGuardar(sucio: boolean) {
  const id = useRef(Symbol());
  useEffect(() => {
    const clave = id.current;
    if (sucio) {
      if (cambios.size === 0)
        ubicacion = { href: window.location.href, state: window.history.state };
      cambios.add(clave);
    } else cambios.delete(clave);
    return () => {
      cambios.delete(clave);
    };
  }, [sucio]);
  useEffect(() => {
    if (usuarios++ === 0) {
      window.addEventListener("beforeunload", cerrar);
      window.addEventListener("popstate", volver, true);
      document.addEventListener("click", navegar, true);
    }
    return () => {
      if (--usuarios === 0) {
        window.removeEventListener("beforeunload", cerrar);
        window.removeEventListener("popstate", volver, true);
        document.removeEventListener("click", navegar, true);
      }
    };
  }, []);
  return () => {
    cambios.delete(id.current);
  };
}
