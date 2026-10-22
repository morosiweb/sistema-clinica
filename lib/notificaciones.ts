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

function transporteGmail(auth: { user: string; pass: string }) {
  return nodemailer.createTransport({
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
}

function errorCorreoSeguro(error: unknown) {
  const detalle =
    error && typeof error === "object"
      ? (error as { code?: unknown; responseCode?: unknown })
      : {};
  const codigos = [
    "EAUTH",
    "ECONNECTION",
    "ETIMEDOUT",
    "ESOCKET",
    "EENVELOPE",
    "EMESSAGE",
    "EDNS",
    "EPROTOCOL",
    "ETLS",
  ];
  const codigo =
    typeof detalle.code === "string" && codigos.includes(detalle.code)
      ? detalle.code
      : "ENVIO_FALLIDO";
  return {
    codigo,
    estadoSmtp:
      typeof detalle.responseCode === "number" &&
      detalle.responseCode >= 400 &&
      detalle.responseCode <= 599
        ? detalle.responseCode
        : null,
  };
}

// Exclusivamente para la ruta protegida de administración. No entrega claves,
// contenido de correos ni respuestas SMTP crudas, y no envía mensajes.
export async function diagnosticarCorreo() {
  const proveedor = proveedorCorreo();
  const auth = credencialesGmail();
  const configuracion = {
    proveedor:
      proveedor === "gmail" || proveedor === "resend"
        ? proveedor
        : "desconocido",
    gmailUsuarioValido: emailSchema.safeParse(process.env.GMAIL_USER).success,
    gmailClaveCargada: !!process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, ""),
    correoConfigurado: correoConfigurado(),
  };
  if (proveedor !== "gmail")
    return {
      ...configuracion,
      ok: false,
      mensaje:
        "Este despliegue no tiene EMAIL_PROVIDER=gmail. Revisá el entorno Production y creá un nuevo despliegue después de guardar las variables.",
    };
  if (!auth)
    return {
      ...configuracion,
      ok: false,
      mensaje:
        "Falta GMAIL_USER válido o GMAIL_APP_PASSWORD en este despliegue. Revisá Production y volvé a desplegar.",
    };
  const transport = transporteGmail(auth);
  try {
    await transport.verify();
    return {
      ...configuracion,
      cuenta: auth.user,
      ok: true,
      mensaje:
        "Google aceptó la conexión y las credenciales. No se envió ningún correo; resta comprobar una entrega real.",
    };
  } catch (error) {
    const detalle = errorCorreoSeguro(error);
    return {
      ...configuracion,
      cuenta: auth.user,
      ok: false,
      ...detalle,
      mensaje:
        detalle.codigo === "EAUTH"
          ? "Google rechazó las credenciales. Revisá que la contraseña de aplicación corresponda a esta misma cuenta y siga vigente."
          : "No se pudo completar la conexión SMTP con Google. El código indica el tipo de fallo, sin exponer datos privados.",
    };
  } finally {
    transport.close();
  }
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
      const transport = transporteGmail(auth);
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
  } catch (error) {
    // No registrar mensajes del proveedor: pueden contener direcciones,
    // contenido o credenciales. El error público tampoco expone esos datos.
    const detalle = errorCorreoSeguro(error);
    console.error(
      `[notificaciones] proveedor=${proveedor} codigo=${detalle.codigo} estadoSmtp=${detalle.estadoSmtp ?? "sin_respuesta"}`,
    );
    return false;
  }
}

// ===================== WHATSAPP (Cloud API de Meta, sin BSP) =====================
// Canal preferido cuando el paciente tiene teléfono: se intenta primero y,
// si no está configurado, no hay teléfono utilizable o Meta rechaza el envío,
// se cae al correo. Nunca se intentan los dos a la vez ni se duplica el aviso.
//
// Requiere plantillas aprobadas de antemano en Meta Business Manager (no se
// puede mandar texto libre fuera de una conversación abierta por el
// paciente). Ver README para el procedimiento y el texto exacto de cada
// plantilla. Los nombres/variables de abajo tienen que coincidir con los que
// se registren en Meta.
const IDIOMA_PLANTILLAS = "es_AR";
export const PLANTILLAS_WHATSAPP = {
  codigo: { nombre: "clinica_codigo_verificacion", categoria: "AUTHENTICATION", variables: 1 },
  confirmacion: { nombre: "clinica_turno_confirmado", categoria: "UTILITY", variables: 6 },
  recordatorio: { nombre: "clinica_turno_recordatorio", categoria: "UTILITY", variables: 6 },
  cancelacion: { nombre: "clinica_turno_cancelado", categoria: "UTILITY", variables: 4 },
  reprogramacion: { nombre: "clinica_turno_reprogramar", categoria: "UTILITY", variables: 5 },
} as const;

function versionGraphAPI() {
  return process.env.WHATSAPP_API_VERSION?.trim() || "v22.0";
}

function credencialesWhatsApp() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const telefonoId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return token && telefonoId ? { token, telefonoId } : null;
}

export function whatsappConfigurado(): boolean {
  return !!credencialesWhatsApp();
}

// WhatsApp exige el número en formato internacional, solo dígitos. Los
// celulares argentinos necesitan el "9" después del código de país (54) que
// el paciente casi nunca escribe así. Es un ajuste específico para Argentina;
// si la clínica atiende otro país, revisar esta función antes de confiar en
// el envío por WhatsApp. Ante cualquier duda devuelve null (cae a email).
export function normalizarTelefonoWhatsApp(
  telefono: string | null | undefined,
): string | null {
  if (!telefono) return null;
  let digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (!digitos.startsWith("54")) digitos = `549${digitos}`;
  else if (!digitos.startsWith("549")) digitos = `549${digitos.slice(2)}`;
  return /^\d{12,13}$/.test(digitos) ? digitos : null;
}

function errorWhatsAppSeguro(detalle: unknown) {
  const error =
    detalle && typeof detalle === "object"
      ? (detalle as { code?: unknown; message?: unknown })
      : {};
  return typeof error.code === "number" ? error.code : "desconocido";
}

// No hay clave de idempotencia en la API de mensajes de Meta (a diferencia de
// Resend). La misma protección que ya existe para el correo (bloqueo por
// turno + estado "enviado" comprobado dentro de la transacción) evita un
// reintento duplicado; esta función en sí no es idempotente.
async function enviarPlantillaWhatsApp(
  telefono: string,
  nombrePlantilla: string,
  parametros: string[],
): Promise<boolean> {
  const credenciales = credencialesWhatsApp();
  if (!credenciales) return false;
  try {
    const respuesta = await fetch(
      `https://graph.facebook.com/${versionGraphAPI()}/${credenciales.telefonoId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credenciales.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefono,
          type: "template",
          template: {
            name: nombrePlantilla,
            language: { code: IDIOMA_PLANTILLAS },
            ...(parametros.length
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: parametros.map((texto) => ({
                        type: "text",
                        text: texto,
                      })),
                    },
                  ],
                }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (respuesta.ok) return true;
    const cuerpo = await respuesta.json().catch(() => null);
    console.error(
      `[notificaciones] whatsapp estado=${respuesta.status} codigo=${errorWhatsAppSeguro(cuerpo?.error)}`,
    );
    return false;
  } catch (error) {
    console.error(
      `[notificaciones] whatsapp fallo_conexion=${error instanceof Error ? error.name : "desconocido"}`,
    );
    return false;
  }
}

export type ResultadoEnvio = {
  enviado: boolean;
  canal: "whatsapp" | "email" | null;
};
type Contacto = { email: string | null; telefono?: string | null };

export async function enviarCodigo(
  contacto: Contacto,
  codigo: string,
): Promise<ResultadoEnvio> {
  const telefono = normalizarTelefonoWhatsApp(contacto.telefono);
  if (telefono && whatsappConfigurado()) {
    const ok = await enviarPlantillaWhatsApp(
      telefono,
      PLANTILLAS_WHATSAPP.codigo.nombre,
      [codigo],
    );
    if (ok) return { enviado: true, canal: "whatsapp" };
  }
  const ok = await enviar(
    contacto.email,
    "Tu código para gestionar turnos",
    `<p>Tu código es <strong>${codigo}</strong>.</p><p>Vence en 10 minutos. No lo compartas. Si no lo solicitaste, ignorá este correo.</p>`,
    `Tu código es ${codigo}. Vence en 10 minutos. No lo compartas.`,
  );
  return { enviado: ok, canal: ok ? "email" : null };
}

type DatosTurno = {
  email: string | null;
  telefono?: string | null;
  nombrePaciente: string;
  fecha: string;
  horaInicio: string;
  medicoNombre: string;
  especialidad: string;
  token?: string;
  claveEnvio?: string;
};

export async function enviarConfirmacionTurno(
  d: DatosTurno,
): Promise<ResultadoEnvio> {
  const link = d.token ? urlCompleta(`/mi-turno/${d.token}`) : null;
  const telefono = normalizarTelefonoWhatsApp(d.telefono);
  if (telefono && whatsappConfigurado()) {
    const ok = await enviarPlantillaWhatsApp(
      telefono,
      PLANTILLAS_WHATSAPP.confirmacion.nombre,
      [
        d.nombrePaciente,
        d.medicoNombre,
        d.especialidad,
        fechaLarga(d.fecha),
        d.horaInicio,
        link ?? "",
      ],
    );
    if (ok) return { enviado: true, canal: "whatsapp" };
  }
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
  const ok = await enviar(d.email, asunto, html, texto, d.claveEnvio);
  return { enviado: ok, canal: ok ? "email" : null };
}

export async function enviarRecordatorioTurno(
  d: DatosTurno,
): Promise<ResultadoEnvio> {
  const link = d.token ? urlCompleta(`/mi-turno/${d.token}`) : null;
  const telefono = normalizarTelefonoWhatsApp(d.telefono);
  if (telefono && whatsappConfigurado()) {
    const ok = await enviarPlantillaWhatsApp(
      telefono,
      PLANTILLAS_WHATSAPP.recordatorio.nombre,
      [
        d.nombrePaciente,
        d.medicoNombre,
        d.especialidad,
        fechaLarga(d.fecha),
        d.horaInicio,
        link ?? "",
      ],
    );
    if (ok) return { enviado: true, canal: "whatsapp" };
  }
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
  const ok = await enviar(d.email, asunto, html, texto, d.claveEnvio);
  return { enviado: ok, canal: ok ? "email" : null };
}

export async function enviarCancelacionTurno(
  d: DatosTurno,
): Promise<ResultadoEnvio> {
  const telefono = normalizarTelefonoWhatsApp(d.telefono);
  if (telefono && whatsappConfigurado()) {
    const ok = await enviarPlantillaWhatsApp(
      telefono,
      PLANTILLAS_WHATSAPP.cancelacion.nombre,
      [d.nombrePaciente, d.medicoNombre, fechaLarga(d.fecha), d.horaInicio],
    );
    if (ok) return { enviado: true, canal: "whatsapp" };
  }
  const asunto = "Tu turno fue cancelado";
  const texto =
    `Hola ${d.nombrePaciente}, te avisamos que la clínica canceló tu turno con ${d.medicoNombre} ` +
    `del ${fechaLarga(d.fecha)} a las ${d.horaInicio}. Comunicate con nosotros para reprogramarlo.`;
  const html = `
    <p>Hola ${escaparHTML(d.nombrePaciente)},</p>
    <p>Te avisamos que la clínica canceló tu turno con <strong>${escaparHTML(d.medicoNombre)}</strong> del
    ${fechaLarga(d.fecha)} a las ${d.horaInicio}. Comunicate con nosotros para reprogramarlo.</p>
  `;
  const ok = await enviar(d.email, asunto, html, texto, d.claveEnvio);
  return { enviado: ok, canal: ok ? "email" : null };
}

export async function enviarReprogramacionPorLicencia(
  d: DatosTurno & { token: string; turnoId: string },
): Promise<ResultadoEnvio> {
  const link = urlCompleta(
    `/mi-turno/${encodeURIComponent(d.token)}?reprogramar=${encodeURIComponent(d.turnoId)}`,
  );
  const telefono = normalizarTelefonoWhatsApp(d.telefono);
  if (telefono && whatsappConfigurado()) {
    const ok = await enviarPlantillaWhatsApp(
      telefono,
      PLANTILLAS_WHATSAPP.reprogramacion.nombre,
      [d.nombrePaciente, d.medicoNombre, fechaLarga(d.fecha), d.horaInicio, link],
    );
    if (ok) return { enviado: true, canal: "whatsapp" };
  }
  const texto = `Hola ${d.nombrePaciente}, tu turno con ${d.medicoNombre} del ${fechaLarga(d.fecha)} a las ${d.horaInicio} debe ser reprogramado porque el profesional no estará disponible. Elegí una nueva fecha y horario desde este enlace: ${link}`;
  const html = `<p>Hola ${escaparHTML(d.nombrePaciente)},</p><p>Tu turno con <strong>${escaparHTML(d.medicoNombre)}</strong> del ${fechaLarga(d.fecha)} a las <strong>${d.horaInicio}</strong> debe ser reprogramado porque el profesional no estará disponible.</p><p><a href="${escaparHTML(link)}">Reprogramar mi turno</a></p>`;
  const ok = await enviar(
    d.email,
    "Tu turno debe ser reprogramado",
    html,
    texto,
    d.claveEnvio,
  );
  return { enviado: ok, canal: ok ? "email" : null };
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
