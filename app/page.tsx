import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ShieldCheck,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import { authVigente as auth } from "@/lib/sesion";
import { PublicHeader, PublicFooter } from "@/components/brand";
export const instant = false;
export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/panel");
  return (
    <div className="public-site">
      <PublicHeader />
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> MÁS CERCA DE TU BIENESTAR
            </p>
            <h1>
              Tu salud merece
              <br />
              un lugar <em>especial.</em>
            </h1>
            <p className="hero-description">
              Una atención cercana empieza con un paso simple. Encontrá a tu
              profesional y reservá el momento para cuidarte.
            </p>
            <div className="hero-actions">
              <Link href="/reservar" className="btn btn-primary">
                Reservar un turno <ArrowUpRight size={19} />
              </Link>
              <Link href="/mi-turno/recuperar" className="btn btn-outline">
                Ya tengo un turno <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-assurance">
              <ShieldCheck size={17} />
              <span>Sin crear una cuenta. Con acceso seguro por email.</span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Ilustración de bienestar y atención médica"
          >
            <div className="art-arch">
              <div className="art-circle" />
              <div className="art-leaf leaf-one" />
              <div className="art-leaf leaf-two" />
              <div className="art-leaf leaf-three" />
              <div className="art-stem" />
              <span className="art-word">
                sentite
                <br />
                <em>bien.</em>
              </span>
              <span className="art-plus">+</span>
            </div>
            <div className="art-note">
              <span className="art-note-icon">
                <CalendarDays size={22} />
              </span>
              <div>
                <strong>Tu próximo paso, más simple.</strong>
                <span>Elegí el día. Nosotros te acompañamos.</span>
              </div>
              <Check size={18} />
            </div>
            <span className="art-caption">UN ESPACIO PENSADO PARA VOS</span>
          </div>
        </section>
        <section className="journey-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SIMPLE, DESDE EL PRINCIPIO</p>
              <h2>Tu próxima consulta, en tres pasos.</h2>
            </div>
            <p>
              Menos vueltas para reservar. <br />
              Más tiempo para lo que importa.
            </p>
          </div>
          <div className="journey-grid">
            {[
              {
                n: "01",
                icon: Stethoscope,
                title: "Encontrá a tu profesional",
                text: "Consultá las especialidades y elegí con quién querés atenderte.",
              },
              {
                n: "02",
                icon: CalendarDays,
                title: "Elegí tu momento",
                text: "Mirá los horarios disponibles y seleccioná el que mejor te quede.",
              },
              {
                n: "03",
                icon: ShieldCheck,
                title: "Confirmá y listo",
                text: "Verificá tu email con un código y gestioná tus turnos sin contraseñas.",
              },
            ].map(({ n, icon: Icon, title, text }) => (
              <article key={n}>
                <div className="journey-top">
                  <Icon size={25} strokeWidth={1.5} />
                  <span>{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="manage-banner">
          <div>
            <p className="eyebrow">TUS TURNOS, A MANO</p>
            <h2>
              Los planes cambian.
              <br />
              Tu turno puede acompañarte.
            </h2>
            <p>
              Consultá tus próximas visitas y revisá las opciones para
              reprogramar o cancelar desde tu acceso personal.
            </p>
          </div>
          <Link href="/mi-turno/recuperar" className="btn btn-white">
            Gestionar mis turnos <ArrowUpRight size={19} />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
