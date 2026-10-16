import { Resend } from "resend";

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function urlCompleta(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function fechaLarga(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", { timeZone: "UTC", dateStyle: "full" });
}

async function enviar(to: string | null, asunto: string, html: string, texto: string) {
  const client = resend();
  if (!client || !to) {
    // Sin RESEND_API_KEY configurada (o paciente sin email): no se corta el
    // flujo, solo queda registrado en el log del servidor.
    console.log(`[notificaciones] (sin enviar) Para: ${to ?? "sin email"} · Asunto: ${asunto}\n${texto}`);
    return;
  }
  const from = process.env.EMAIL_FROM ?? "Sistema Clínica <onboarding@resend.dev>";
  const { error } = await client.emails.send({ from, to, subject: asunto, html, text: texto });
  if (error) {
    console.error(`[notificaciones] Error enviando a ${to}:`, error);
  }
}

type DatosTurno = {
  email: string | null;
  nombrePaciente: string;
  fecha: string;
  horaInicio: string;
  medicoNombre: string;
  especialidad: string;
  token?: string;
};

export async function enviarConfirmacionTurno(d: DatosTurno) {
  const link = d.token ? urlCompleta(`/mi-turno/${d.token}`) : null;
  const asunto = "Turno confirmado";
  const texto =
    `Hola ${d.nombrePaciente}, tu turno con ${d.medicoNombre} (${d.especialidad}) ` +
    `quedó reservado para el ${fechaLarga(d.fecha)} a las ${d.horaInicio}.` +
    (link ? `\n\nGestioná tus turnos acá: ${link}` : "");
  const html = `
    <p>Hola ${d.nombrePaciente},</p>
    <p>Tu turno con <strong>${d.medicoNombre}</strong> (${d.especialidad}) quedó reservado para el
    <strong>${fechaLarga(d.fecha)}</strong> a las <strong>${d.horaInicio}</strong>.</p>
    ${link ? `<p><a href="${link}">Ver, cancelar o reprogramar tu turno</a></p>` : ""}
  `;
  await enviar(d.email, asunto, html, texto);
}

export async function enviarRecordatorioTurno(d: DatosTurno) {
  const link = d.token ? urlCompleta(`/mi-turno/${d.token}`) : null;
  const asunto = "Recordatorio de tu turno";
  const texto =
    `Hola ${d.nombrePaciente}, te recordamos tu turno con ${d.medicoNombre} (${d.especialidad}) ` +
    `el ${fechaLarga(d.fecha)} a las ${d.horaInicio}.` +
    (link ? `\n\nSi necesitás cancelarlo: ${link}` : "");
  const html = `
    <p>Hola ${d.nombrePaciente},</p>
    <p>Te recordamos tu turno con <strong>${d.medicoNombre}</strong> (${d.especialidad}) el
    <strong>${fechaLarga(d.fecha)}</strong> a las <strong>${d.horaInicio}</strong>.</p>
    ${link ? `<p>Si necesitás cancelarlo o reprogramarlo: <a href="${link}">hacé click acá</a></p>` : ""}
  `;
  await enviar(d.email, asunto, html, texto);
}

export async function enviarCancelacionTurno(d: DatosTurno) {
  const asunto = "Tu turno fue cancelado";
  const texto =
    `Hola ${d.nombrePaciente}, te avisamos que la clínica canceló tu turno con ${d.medicoNombre} ` +
    `del ${fechaLarga(d.fecha)} a las ${d.horaInicio}. Comunicate con nosotros para reprogramarlo.`;
  const html = `
    <p>Hola ${d.nombrePaciente},</p>
    <p>Te avisamos que la clínica canceló tu turno con <strong>${d.medicoNombre}</strong> del
    ${fechaLarga(d.fecha)} a las ${d.horaInicio}. Comunicate con nosotros para reprogramarlo.</p>
  `;
  await enviar(d.email, asunto, html, texto);
}

export async function enviarLinkPaciente(destino: { email: string | null; nombre: string }, link: string) {
  const asunto = "Tu acceso a turnos";
  const url = urlCompleta(link);
  const texto = `Hola ${destino.nombre}, este es tu link personal para gestionar tus turnos: ${url}`;
  const html = `<p>Hola ${destino.nombre},</p><p>Este es tu link personal para gestionar tus turnos:</p><p><a href="${url}">${url}</a></p>`;
  await enviar(destino.email, asunto, html, texto);
}
