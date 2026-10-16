import Link from "next/link";

export function Brand({
  light = false,
  href = "/",
}: {
  light?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Clínica · Inicio"
    >
      <span className="brand-symbol" aria-hidden="true">
        <span />
      </span>
      <span>
        clínica<span className="brand-caption">SALUD Y BIENESTAR</span>
      </span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Brand />
        <nav aria-label="Navegación de pacientes">
          <Link href="/mi-turno/recuperar" className="header-manage">
            Mis turnos
          </Link>
          <Link href="/reservar" className="btn btn-primary btn-small">
            Reservar turno <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/login" className="staff-link">
            Acceso del personal
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>Clínica · Cuidamos cada paso de tu atención.</span>
      <Link href="/login">
        Acceso del personal <span aria-hidden="true">↗</span>
      </Link>
    </footer>
  );
}
