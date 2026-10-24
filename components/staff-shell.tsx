"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  Layers,
  CalendarOff,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  HeartPulse,
} from "lucide-react";
import { confirmarSalida } from "@/lib/cambios-sin-guardar";
import { Brand } from "@/components/brand";
import { Volver } from "@/components/volver";

const icons: Record<string, typeof Users> = {
  pacientes: Users,
  turnos: CalendarDays,
  agenda: CalendarDays,
  medicos: Stethoscope,
  especialidades: Layers,
  bloqueos: CalendarOff,
  usuarios: ShieldCheck,
};
const roles: Record<string, string> = {
  ADMIN: "Administración",
  SECRETARIA: "Secretaría",
  MEDICO: "Profesional de salud",
};

export function StaffShell({
  children,
  nombre,
  rol,
  pantallas,
  salir,
}: {
  children: React.ReactNode;
  nombre: string;
  rol: string;
  pantallas: { key: string; href: string; label: string; grupo: string }[];
  salir: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const cerrar = () => setOpen(false);
    media.addEventListener("change", cerrar);
    return () => media.removeEventListener("change", cerrar);
  }, []);
  useEffect(() => {
    if (!open) return;
    const mobile = window.matchMedia("(max-width: 800px)").matches;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menu.current;
    if (mobile) {
      document.body.style.overflow = "hidden";
      sidebar.current
        ?.querySelector<HTMLButtonElement>(".mobile-close")
        ?.focus();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton?.focus();
        return;
      }
      if (event.key !== "Tab" || !mobile) return;
      const elements = Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled)",
        ) || [],
      );
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      if (mobile) menuButton?.focus();
    };
  }, [open]);
  const actual =
    (pathname === "/cuenta"
      ? "Mi cuenta"
      : pantallas.find((p) => pathname.startsWith(p.href))?.label) || "Inicio";
  return (
    <div
      className="staff-app"
      onPointerMove={(event) => {
        if (
          event.pointerType !== "mouse" ||
          window.matchMedia("(max-width: 800px)").matches
        )
          return;
        // Detectar la cercanía sin una capa invisible sobre los botones.
        if (event.clientX <= 64) setOpen(true);
        else if (
          sidebar.current &&
          event.clientX > sidebar.current.offsetWidth &&
          !sidebar.current.contains(document.activeElement)
        )
          setOpen(false);
      }}
    >
      <a href="#contenido" className="skip-link">
        Ir al contenido
      </a>
      <button
        className="sidebar-edge"
        aria-label="Mostrar menú lateral"
        aria-expanded={open}
        aria-controls="menu-lateral"
        onClick={() => setOpen(true)}
      />
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="menu-lateral"
        ref={sidebar}
        className={`sidebar ${open ? "sidebar-open" : ""}`}
        aria-label="Menú del sistema"
        aria-hidden={!open}
        inert={!open}
        onPointerLeave={(event) => {
          if (
            event.pointerType === "mouse" &&
            !sidebar.current?.contains(document.activeElement)
          )
            setOpen(false);
        }}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget) &&
            !event.currentTarget.matches(":hover")
          )
            setOpen(false);
        }}
      >
        <div className="sidebar-brand">
          <Brand light href="/panel" />
          <button
            className="mobile-close icon-btn"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="workspace-label">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal">
          <Link
            className={`nav-item ${pathname === "/panel" ? "nav-active" : ""}`}
            aria-current={pathname === "/panel" ? "page" : undefined}
            href="/panel"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard size={19} />
            Inicio
          </Link>
          {["Operación", "Administración"].map((grupo) => (
            <div key={grupo}>
              {pantallas.some((p) => p.grupo === grupo) && (
                <p className="nav-group">{grupo}</p>
              )}
              {pantallas
                .filter((p) => p.grupo === grupo)
                .map((p) => {
                  const Icon = icons[p.key] || HeartPulse;
                  const active = pathname.startsWith(p.href);
                  return (
                    <Link
                      key={p.key}
                      href={p.href}
                      className={`nav-item ${active ? "nav-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon size={19} />
                      {p.label}
                      {active && <ChevronRight size={15} className="ml-auto" />}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-avatar">
            {nombre
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="user-info">
            <strong>{nombre}</strong>
            <span>{roles[rol] || rol}</span>
            <Link
              className="account-link"
              href="/cuenta"
              onClick={() => setOpen(false)}
            >
              Mi cuenta
            </Link>
          </div>
          <form
            action={salir}
            onSubmit={(e) => {
              if (!confirmarSalida()) e.preventDefault();
            }}
          >
            <button
              className="icon-btn"
              title="Cerrar sesión"
              aria-label="Salir"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className="staff-main">
        <header className="workspace-header">
          <div className="flex items-center gap-3">
            <button
              ref={menu}
              className="mobile-menu icon-btn"
              aria-label="Abrir menú"
              aria-expanded={open}
              aria-controls="menu-lateral"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Mi espacio</span>
            <ChevronRight size={14} />
            <span>{actual}</span>
          </div>
          <span className="workspace-status">
            <span /> Gestión clínica
          </span>
        </header>
        <main id="contenido" className="staff-content">
          <Volver />
          {children}
        </main>
        <footer className="staff-footer">
          Clínica <span>Un espacio para cuidar mejor.</span>
        </footer>
      </div>
    </div>
  );
}
