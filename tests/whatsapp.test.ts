import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { SMTPServer } from "smtp-server";
import { simpleParser, type ParsedMail } from "mailparser";
import {
  enviarCodigo,
  enviarConfirmacionTurno,
  enviarCancelacionTurno,
  normalizarTelefonoWhatsApp,
  whatsappConfigurado,
} from "../lib/notificaciones";

const variables = [
  "EMAIL_PROVIDER",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXTAUTH_URL",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_API_VERSION",
] as const;
const anteriores = new Map(variables.map((key) => [key, process.env[key]]));
const recibidos: ParsedMail[] = [];
let puerto = 0;
const crearTransporte = nodemailer.createTransport.bind(nodemailer);
const servidor = new SMTPServer({
  secure: false,
  disabledCommands: ["STARTTLS"],
  allowInsecureAuth: true,
  logger: false,
  onAuth(_auth, _session, callback) {
    callback(null, { user: "emisor" });
  },
  onData(stream, _session, callback) {
    simpleParser(stream)
      .then((mail) => {
        recibidos.push(mail);
        callback();
      })
      .catch(callback);
  },
});

// La API de mensajes de Meta se llama con fetch global. Node no permite
// mockear `globalThis.fetch` con mock.method de forma confiable en todas las
// versiones, así que se reemplaza y restaura a mano.
const fetchOriginal = globalThis.fetch;
type LlamadaFetch = { url: string; init: RequestInit };
let llamadas: LlamadaFetch[] = [];
function simularWhatsApp(
  responder: (llamada: LlamadaFetch) => Response | Promise<Response>,
) {
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const llamada = { url: String(url), init: init ?? {} };
    llamadas.push(llamada);
    return responder(llamada);
  }) as typeof fetch;
}
function restaurarFetch() {
  globalThis.fetch = fetchOriginal;
  llamadas = [];
}

before(async () => {
  await new Promise<void>((resolve) =>
    servidor.listen(0, "127.0.0.1", resolve),
  );
  const address = servidor.server.address();
  assert(address && typeof address !== "string");
  puerto = address.port;
  mock.method(
    nodemailer,
    "createTransport",
    (options: SMTPTransport.Options) =>
      crearTransporte({
        host: "127.0.0.1",
        port: puerto,
        secure: false,
        ignoreTLS: true,
        auth: options.auth,
      }),
  );
});

beforeEach(() => {
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.GMAIL_USER = "emisor@gmail.com";
  process.env.GMAIL_APP_PASSWORD = "clave de prueba";
  process.env.NEXTAUTH_URL = "https://clinica.example.test";
  delete process.env.RESEND_API_KEY;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_API_VERSION;
  recibidos.length = 0;
  restaurarFetch();
});

after(async () => {
  mock.restoreAll();
  restaurarFetch();
  for (const key of variables) {
    const previo = anteriores.get(key);
    if (previo === undefined) delete process.env[key];
    else process.env[key] = previo;
  }
  await new Promise<void>((resolve) => servidor.close(resolve));
});

test("normalizarTelefonoWhatsApp ajusta números argentinos al formato internacional", () => {
  assert.equal(normalizarTelefonoWhatsApp("11 2233-4455"), "5491122334455");
  assert.equal(normalizarTelefonoWhatsApp("011-2233-4455"), "5491122334455");
  assert.equal(normalizarTelefonoWhatsApp("+54 11 2233 4455"), "5491122334455");
  assert.equal(normalizarTelefonoWhatsApp("5491122334455"), "5491122334455");
  assert.equal(normalizarTelefonoWhatsApp(""), null);
  assert.equal(normalizarTelefonoWhatsApp(null), null);
  assert.equal(normalizarTelefonoWhatsApp(undefined), null);
  assert.equal(normalizarTelefonoWhatsApp("abc"), null);
});

test("sin variables de WhatsApp, el código se manda por email aunque haya teléfono", async () => {
  assert.equal(whatsappConfigurado(), false);
  simularWhatsApp(() => {
    throw new Error("no debería llamarse a WhatsApp sin configurar");
  });
  const resultado = await enviarCodigo(
    { email: "paciente@example.test", telefono: "11 2233-4455" },
    "123456",
  );
  assert.deepEqual(resultado, { enviado: true, canal: "email" });
  assert.equal(llamadas.length, 0);
  assert.equal(recibidos.length, 1);
  assert.match(recibidos[0].text || "", /123456/);
});

test("con WhatsApp configurado y teléfono válido, se manda la plantilla y no se toca el email", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "token-de-prueba";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
  simularWhatsApp(
    () => new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] })),
  );
  const resultado = await enviarCodigo(
    { email: "paciente@example.test", telefono: "11 2233-4455" },
    "123456",
  );
  assert.deepEqual(resultado, { enviado: true, canal: "whatsapp" });
  assert.equal(recibidos.length, 0);
  assert.equal(llamadas.length, 1);
  assert.equal(
    llamadas[0].url,
    "https://graph.facebook.com/v22.0/1234567890/messages",
  );
  assert.equal(llamadas[0].init.method, "POST");
  assert.equal(
    (llamadas[0].init.headers as Record<string, string>).Authorization,
    "Bearer token-de-prueba",
  );
  const cuerpo = JSON.parse(llamadas[0].init.body as string);
  assert.equal(cuerpo.messaging_product, "whatsapp");
  assert.equal(cuerpo.to, "5491122334455");
  assert.equal(cuerpo.template.name, "clinica_codigo_verificacion");
  assert.equal(cuerpo.template.language.code, "es_AR");
  assert.deepEqual(cuerpo.template.components, [
    { type: "body", parameters: [{ type: "text", text: "123456" }] },
  ]);
});

test("usa la versión de Graph API configurada por entorno", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "999";
  process.env.WHATSAPP_API_VERSION = "v99.0";
  simularWhatsApp(() => new Response("{}"));
  await enviarCodigo({ email: null, telefono: "11 2233-4455" }, "000000");
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].url, /^https:\/\/graph\.facebook\.com\/v99\.0\//);
});

test("si Meta rechaza el envío, cae al email sin exponer el token ni el mensaje de Meta en el log", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "token-secreto";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
  simularWhatsApp(
    () =>
      new Response(
        JSON.stringify({
          error: { code: 131026, message: "mensaje interno de Meta" },
        }),
        { status: 400 },
      ),
  );
  const log = mock.method(console, "error", () => {});
  try {
    const resultado = await enviarConfirmacionTurno({
      email: "paciente@example.test",
      telefono: "11 2233-4455",
      nombrePaciente: "Paciente Prueba",
      fecha: "2026-10-20T00:00:00Z",
      horaInicio: "10:15",
      medicoNombre: "Profesional Prueba",
      especialidad: "Clínica médica",
    });
    assert.deepEqual(resultado, { enviado: true, canal: "email" });
    assert.equal(recibidos.length, 1);
    const logs = JSON.stringify(log.mock.calls.map((c) => c.arguments));
    assert.match(logs, /estado=400 codigo=131026/);
    assert(!logs.includes("token-secreto"));
    assert(!logs.includes("mensaje interno de Meta"));
  } finally {
    log.mock.restore();
  }
});

test("un teléfono que no se puede normalizar no intenta WhatsApp y usa el email", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "999";
  simularWhatsApp(() => {
    throw new Error("no debería llamarse con un teléfono inválido");
  });
  const resultado = await enviarCancelacionTurno({
    email: "paciente@example.test",
    telefono: "abc",
    nombrePaciente: "Paciente",
    fecha: "2026-10-20T00:00:00Z",
    horaInicio: "10:15",
    medicoNombre: "Profesional",
    especialidad: "Clínica",
  });
  assert.deepEqual(resultado, { enviado: true, canal: "email" });
  assert.equal(llamadas.length, 0);
});

test("una falla de red al llamar a WhatsApp no se informa como enviado", async () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "999";
  simularWhatsApp(() => {
    throw new Error("Fallo de red simulado");
  });
  const log = mock.method(console, "error", () => {});
  try {
    const resultado = await enviarCodigo(
      { email: "paciente@example.test", telefono: "11 2233-4455" },
      "123456",
    );
    assert.deepEqual(resultado, { enviado: true, canal: "email" });
    assert.equal(recibidos.length, 1);
  } finally {
    log.mock.restore();
  }
});
