import type { RolInterno } from "@/app/generated/prisma/client";

export type Pantalla = {
  key: string;
  label: string;
  grupo: string;
  href: string;
  // false = la pantalla ya existe en el catálogo de permisos (para que el
  // admin pueda habilitarla de antemano) pero su página todavía no está
  // construida, así que no se muestra en la navegación para evitar un 404.
  implementada?: boolean;
};

export const PANTALLAS: readonly Pantalla[] = [
  {
    key: "pacientes",
    label: "Pacientes",
    grupo: "Operación",
    href: "/pacientes",
    implementada: true,
  },
  {
    key: "turnos",
    label: "Turnos",
    grupo: "Operación",
    href: "/turnos",
    implementada: true,
  },
  {
    key: "agenda",
    label: "Mi agenda",
    grupo: "Operación",
    href: "/agenda",
    implementada: true,
  },
  {
    key: "medicos",
    label: "Médicos",
    grupo: "Administración",
    href: "/medicos",
    implementada: true,
  },
  {
    key: "especialidades",
    label: "Especialidades",
    grupo: "Administración",
    href: "/especialidades",
    implementada: true,
  },
  {
    key: "bloqueos",
    label: "Licencias",
    grupo: "Administración",
    href: "/bloqueos",
    implementada: true,
  },
  {
    key: "usuarios",
    label: "Usuarios",
    grupo: "Administración",
    href: "/admin/usuarios",
    implementada: true,
  },
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
  claves: readonly string[],
): boolean {
  if (rol === "ADMIN") return true;
  const permitidas = permisos ?? permisosPorRol(rol);
  const maximas = permisosPorRol(rol);
  return claves.some(
    (clave) => maximas.includes(clave) && permitidas.includes(clave),
  );
}

export function pantallasPermitidas(
  permisos: string[] | null,
  rol: RolInterno,
): Pantalla[] {
  return PANTALLAS.filter(
    (p) => p.implementada && puedeVer(permisos, rol, [p.key]),
  );
}

export function hrefDe(clave: string): string | undefined {
  return PANTALLAS.find((p) => p.key === clave)?.href;
}

export function primerHrefPermitido(
  permisos: string[] | null,
  rol: RolInterno,
): string {
  return pantallasPermitidas(permisos, rol)[0]?.href ?? "/login";
}

export function permisosPorRol(rol: RolInterno): string[] {
  if (rol === "ADMIN") return PANTALLAS.map((p) => p.key);
  if (rol === "MEDICO") return ["agenda", "bloqueos"];
  return ["pacientes", "turnos", "medicos", "especialidades", "bloqueos"];
}
