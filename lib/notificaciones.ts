import { Resend } from "resend";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { emailSchema } from "@/lib/validations/comun";

function proveedorCorreo() {
  return process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "resend";
}

function credencialesGmail() {
  const email = emailSchema.safeParse(process.env.GMAIL_USER);
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  return email.success && password
    ? { user: email.data, pass: password }
    : null;
}

export function correoConfigurado(): boolean {
  if (proveedorCorreo() === "gmail") return !!credencialesGmail();
  return proveedorCorreo() === "resend" && !!process.env.RESEND_API_KEY?.trim();
}

function urlCompleta(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function fechaLarga(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    dateStyle: "full",
  });
}

export function escaparHTML(valor: string): string {
  return valor.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

export async function enviar(
  to: string | null,
  asunto: string,
  html: string,
  texto: string,
  clave?: string,
): Promise<boolean> {
  if (!to || !correoConfigurado()) return false;
  const proveedor = proveedorCorreo();
  try {
    if (proveedor === "gmail") {
      const auth = credencialesGmail()!;
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
        dnsTimeout: 5000,
        disableFileAccess: true,
        disableUrlAccess: true,
        logger: false,
        debug: false,
      });
      // SMTP no tiene la idempotencia de la API de Resend. Se conserva el
      // bloqueo/estado de cada recordatorio y un Message-ID estable por clave.
      const messageId = clave
        ? `<${createHash("sha256").update(clave).digest("hex")}@${auth.user.split("@")[1]}>`
        : undefined;
      const resultado = await transport.sendMail({
        from: { name: "Clínica", address: auth.user },
        to,
        subject: asunto,
        html,
        text: texto,
        messageId,
      });
      return resultado.accepted.length > 0 && resultado.rejected.length === 0;
    }
    const client = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.EMAIL_FROM ?? "Sistema Clínica <onboarding@resend.dev>";
    const { error } = await client.emails.send(
      { from, to, subject: asunto, html, text: texto },
      clave ? { idempotencyKey: clave } : undefined,
    );
    if (error) console.error("[notificaciones] Resend rechazó el envío");
    return !error;
  } catch {
    // No registrar mensajes del proveedor: pueden contener direcciones,
    // contenido o credenciales. El error público tampoco expone esos datos.
    console.error(`[notificaciones] No se pudo enviar mediante ${proveedor}`);
    return false;
  }
}

export async function enviarCodigo(email: string, codigo: string) {
  return enviar(
    email,
    "Tu código para gestionar turnos",
    `<p>Tu código es <strong>${codigo}</strong>.</p><p>Vence en 10 minutos. No lo compartas. Si no lo solicitaste, ignorá este correo.</p>`,
    `Tu código es ${codigo}. Vence en 10 minutos. No lo compartas.`,
  );
}

type DatosTurno = {
  email: string | null;
  nombrePaciente: string;
  fecha: string;
  horaInicio: string;
  medicoNombre: string;
  especialidad: string;
  token?: string;
  claveEnvio?: string;
};

export async function enviarConfirmacionTurno(d: DatosTurno) {
  const link = d.token ? urlCompleta(`/mi-turno/${d.token}`) : null;
  const asunto = "Turno confirmado";
  const texto =
    `Hola ${d.nombrePaciente}, tu turno con ${d.medicoNombre} (${d.especialidad}) ` +
    `quedó reservado para el ${fechaLarga(d.fecha)} a las ${d.horaInicio}.` +
    (link ? `\n\nGestioná tus turnos acá: ${link}` : "");
  const html = `
    <p>Hola ${escaparHTML(d.nombrePaciente)},</p>
    <p>Tu turno con <strong>${escaparHTML(d.medicoNombre)}</strong> (${escaparHTML(d.especialidad)}) quedó reservado para el
    <strong>${fechaLarga(d.fecha)}</strong> a las <strong>${d.horaInicio}</strong>.</p>
    ${link ? `<p><a href="${link}">Ver, cancelar o reprogramar tu turno</a></p>` : ""}
  `;
  return enviar(d.email, asunto, html, texto, d.claveEnvio);
}

export async function enviarRecordatorioTurno(d: DatosTurno) {
  const link = d.token ? urlCompleta(`/mi-turno/${d.token}`) : null;
  const asunto = "Recordatorio de tu turno";
  const texto =
    `Hola ${d.nombrePaciente}, te recordamos tu turno con ${d.medicoNombre} (${d.especialidad}) ` +
    `el ${fechaLarga(d.fecha)} a las ${d.horaInicio}.` +
    (link ? `\n\nSi necesitás cancelarlo: ${link}` : "");
  const html = `
    <p>Hola ${escaparHTML(d.nombrePaciente)},</p>
    <p>Te recordamos tu turno con <strong>${escaparHTML(d.medicoNombre)}</strong> (${escaparHTML(d.especialidad)}) el
    <strong>${fechaLarga(d.fecha)}</strong> a las <strong>${d.horaInicio}</strong>.</p>
    ${link ? `<p>Si necesitás cancelarlo o reprogramarlo: <a href="${link}">hacé click acá</a></p>` : ""}
  `;
  return enviar(d.email, asunto, html, texto, d.claveEnvio);
}

export async function enviarCancelacionTurno(d: DatosTurno) {
  const asunto = "Tu turno fue cancelado";
  const texto =
    `Hola ${d.nombrePaciente}, te avisamos que la clínica canceló tu turno con ${d.medicoNombre} ` +
    `del ${fechaLarga(d.fecha)} a las ${d.horaInicio}. Comunicate con nosotros para reprogramarlo.`;
  const html = `
    <p>Hola ${escaparHTML(d.nombrePaciente)},</p>
    <p>Te avisamos que la clínica canceló tu turno con <strong>${escaparHTML(d.medicoNombre)}</strong> del
    ${fechaLarga(d.fecha)} a las ${d.horaInicio}. Comunicate con nosotros para reprogramarlo.</p>
  `;
  return enviar(d.email, asunto, html, texto, d.claveEnvio);
}

export async function enviarLinkPaciente(
  destino: { email: string | null; nombre: string },
  link: string,
) {
  const asunto = "Tu acceso a turnos";
  const url = urlCompleta(link);
  const texto = `Hola ${destino.nombre}, este es tu link personal para gestionar tus turnos: ${url}`;
  const html = `<p>Hola ${escaparHTML(destino.nombre)},</p><p>Este es tu link personal para gestionar tus turnos:</p><p><a href="${url}">${url}</a></p>`;
  return enviar(destino.email, asunto, html, texto);
}
