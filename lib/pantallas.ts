import type { RolInterno } from "@/app/generated/prisma/client";

export type Pantalla = {
  key: string;
  label: string;
  grupo: string;
  href: string;
};

export const PANTALLAS: readonly Pantalla[] = [
  { key: "pacientes", label: "Pacientes", grupo: "Operación", href: "/pacientes" },
  { key: "turnos", label: "Turnos", grupo: "Operación", href: "/turnos" },
  { key: "agenda", label: "Mi agenda", grupo: "Operación", href: "/agenda" },
  { key: "medicos", label: "Médicos", grupo: "Administración", href: "/medicos" },
  { key: "especialidades", label: "Especialidades", grupo: "Administración", href: "/especialidades" },
  { key: "bloqueos", label: "Licencias", grupo: "Administración", href: "/bloqueos" },
  { key: "reportes", label: "Reportes", grupo: "Administración", href: "/reportes" },
  { key: "usuarios", label: "Usuarios", grupo: "Administración", href: "/admin/usuarios" },
] as const;

// Usuario.permisos es un String? con JSON de claves de PANTALLAS.
// null/vacío = todas las pantallas. JSON invalido => [] (nunca "todas" por error).
export function parsePermisos(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function serializarPermisos(claves: string[]): string {
  return JSON.stringify(claves);
}

export function puedeVer(
  permisos: string[] | null,
  rol: RolInterno,
  claves: readonly string[]
): boolean {
  if (rol === "ADMIN") return true;
  if (permisos === null) return true;
  return claves.some((clave) => permisos.includes(clave));
}

export function pantallasPermitidas(
  permisos: string[] | null,
  rol: RolInterno
): Pantalla[] {
  return PANTALLAS.filter((p) => puedeVer(permisos, rol, [p.key]));
}

export function hrefDe(clave: string): string | undefined {
  return PANTALLAS.find((p) => p.key === clave)?.href;
}

export function primerHrefPermitido(
  permisos: string[] | null,
  rol: RolInterno
): string {
  return pantallasPermitidas(permisos, rol)[0]?.href ?? "/login";
}
