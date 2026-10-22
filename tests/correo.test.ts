import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { SMTPServer } from "smtp-server";
import { simpleParser, type ParsedMail } from "mailparser";
import {
  correoConfigurado,
  enviarCodigo,
  enviarConfirmacionTurno,
  enviarRecordatorioTurno,
  enviarCancelacionTurno,
  enviarLinkPaciente,
  diagnosticarCorreo,
  enviarReprogramacionPorLicencia,
} from "../lib/notificaciones";

const variables = [
  "EMAIL_PROVIDER",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXTAUTH_URL",
] as const;
const anteriores = new Map(variables.map((key) => [key, process.env[key]]));
const recibidos: ParsedMail[] = [];
const clavePrueba = "abcdefghijklmnop";
let rechazar = false;
let puerto = 0;
const crearTransporte = nodemailer.createTransport.bind(nodemailer);
const servidor = new SMTPServer({
  secure: false,
  disabledCommands: ["STARTTLS"],
  allowInsecureAuth: true,
  logger: false,
  onAuth(auth, _session, callback) {
    if (auth.username !== "emisor@gmail.com" || auth.password !== clavePrueba)
      return callback(new Error("Credenciales de prueba inválidas"));
    callback(null, { user: "emisor" });
  },
  onData(stream, _session, callback) {
    simpleParser(stream)
      .then((mail) => {
        if (rechazar)
          return callback(
            Object.assign(new Error("Fallo SMTP simulado"), {
              responseCode: 451,
            }),
          );
        recibidos.push(mail);
        callback();
      })
      .catch(callback);
  },
});

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
    (options: SMTPTransport.Options) => {
      // El código real siempre conecta a Gmail con TLS y validación de certificados.
      // Solo este proceso de pruebas sustituye la conexión por un receptor local.
      assert.equal(options.host, "smtp.gmail.com");
      assert.equal(options.port, 465);
      assert.equal(options.secure, true);
      assert.notEqual(options.tls?.rejectUnauthorized, false);
      assert.equal(options.logger, false);
      assert.equal(options.debug, false);
      return crearTransporte({
        host: "127.0.0.1",
        port: puerto,
        secure: false,
        ignoreTLS: true,
        auth: options.auth,
      });
    },
  );
});

beforeEach(() => {
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.GMAIL_USER = "emisor@gmail.com";
  process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
  process.env.EMAIL_FROM = "Anterior <onboarding@resend.dev>";
  process.env.NEXTAUTH_URL = "https://clinica.example.test";
  delete process.env.RESEND_API_KEY;
  recibidos.length = 0;
  rechazar = false;
});

after(async () => {
  mock.restoreAll();
  for (const key of variables) {
    const previo = anteriores.get(key);
    if (previo === undefined) delete process.env[key];
    else process.env[key] = previo;
  }
  await new Promise<void>((resolve) => servidor.close(resolve));
});

test("Gmail funciona sin Resend y acepta la clave de aplicación con espacios", async () => {
  assert.equal(correoConfigurado(), true);
  assert.deepEqual(
    await enviarCodigo({ email: "paciente@example.test" }, "123456"),
    { enviado: true, canal: "email" },
  );
  assert.equal(recibidos.length, 1);
  assert.equal(recibidos[0].from?.value[0].address, "emisor@gmail.com");
  assert.equal(recibidos[0].subject, "Tu código para gestionar turnos");
  assert.match(recibidos[0].text || "", /123456/);
  assert.equal(
    recibidos[0].to && !Array.isArray(recibidos[0].to)
      ? recibidos[0].to.value[0].address
      : null,
    "paciente@example.test",
  );
});

test("la configuración incompleta o desconocida no cae a otro proveedor", async () => {
  process.env.RESEND_API_KEY = "re_test_only";
  delete process.env.GMAIL_APP_PASSWORD;
  assert.equal(correoConfigurado(), false);
  assert.deepEqual(
    await enviarCodigo({ email: "paciente@example.test" }, "123456"),
    { enviado: false, canal: null },
  );
  process.env.GMAIL_APP_PASSWORD = clavePrueba;
  process.env.GMAIL_USER = "correo-invalido";
  assert.equal(correoConfigurado(), false);
  process.env.EMAIL_PROVIDER = "desconocido";
  assert.equal(correoConfigurado(), false);
  delete process.env.EMAIL_PROVIDER;
  assert.equal(correoConfigurado(), true);
  assert.equal(recibidos.length, 0);
});

test("un error de autenticación SMTP devuelve fallo sin exponer credenciales", async () => {
  process.env.GMAIL_APP_PASSWORD = "password-incorrecto";
  const log = mock.method(console, "error", () => {});
  try {
    assert.deepEqual(
      await enviarCodigo({ email: "paciente@example.test" }, "654321"),
      { enviado: false, canal: null },
    );
    assert.equal(recibidos.length, 0);
    const logs = JSON.stringify(log.mock.calls.map((call) => call.arguments));
    assert.equal(log.mock.calls[0].arguments.length, 1);
    assert.match(logs, /proveedor=gmail codigo=EAUTH estadoSmtp=535/);
    assert(!logs.includes("password-incorrecto"));
    assert(!logs.includes("654321"));
    assert(!logs.includes("paciente@example.test"));
  } finally {
    log.mock.restore();
  }
});

test("el diagnóstico verifica Google sin enviar mensajes ni revelar la clave", async () => {
  const conectado = await diagnosticarCorreo();
  assert.equal(conectado.ok, true);
  assert.equal(recibidos.length, 0);
  process.env.GMAIL_APP_PASSWORD = "clave-invalida";
  const rechazado = await diagnosticarCorreo();
  assert.equal(rechazado.ok, false);
  assert("codigo" in rechazado && rechazado.codigo === "EAUTH");
  assert(!JSON.stringify(rechazado).includes("clave-invalida"));
  assert.equal(recibidos.length, 0);
  process.env.EMAIL_PROVIDER = "resend";
  const proveedor = await diagnosticarCorreo();
  assert.equal(proveedor.proveedor, "resend");
  assert.equal(proveedor.ok, false);
});

test("las confirmaciones, recordatorios, cancelaciones y enlaces usan Gmail", async () => {
  const datos = {
    email: "paciente@example.test",
    nombrePaciente: "Paciente <Prueba>",
    fecha: "2026-10-20T00:00:00Z",
    horaInicio: "10:15",
    medicoNombre: "Profesional Prueba",
    especialidad: "Clínica médica",
    token: "token-solo-de-prueba",
    claveEnvio: "recordatorio/turno-prueba",
  };
  assert.deepEqual(await enviarConfirmacionTurno(datos), {
    enviado: true,
    canal: "email",
  });
  assert.deepEqual(await enviarRecordatorioTurno(datos), {
    enviado: true,
    canal: "email",
  });
  assert.deepEqual(await enviarCancelacionTurno(datos), {
    enviado: true,
    canal: "email",
  });
  assert.equal(
    await enviarLinkPaciente(
      { email: datos.email, nombre: datos.nombrePaciente },
      "/mi-turno/token-solo-de-prueba",
    ),
    true,
  );
  assert.equal(recibidos.length, 4);
  assert(
    recibidos.every(
      (mail) => mail.from?.value[0].address === "emisor@gmail.com",
    ),
  );
  assert.match(
    recibidos[0].text || "",
    /https:\/\/clinica\.example\.test\/mi-turno\/token-solo-de-prueba/,
  );
  assert.match(recibidos[0].html || "", /Paciente &lt;Prueba&gt;/);
  assert(!recibidos[1].messageId?.includes("turno-prueba"));
});

test("un rechazo del servidor SMTP no se informa como envío exitoso", async () => {
  rechazar = true;
  const log = mock.method(console, "error", () => {});
  try {
    assert.deepEqual(
      await enviarCodigo({ email: "paciente@example.test" }, "123456"),
      { enviado: false, canal: null },
    );
    assert.equal(recibidos.length, 0);
  } finally {
    log.mock.restore();
  }
});

test("el aviso de licencia incluye la reprogramación directa y escapa el contenido del paciente", async () => {
  assert.deepEqual(
    await enviarReprogramacionPorLicencia({
      email: "paciente@example.test",
      nombrePaciente: "Paciente <Prueba>",
      fecha: "2026-10-20T00:00:00Z",
      horaInicio: "10:15",
      medicoNombre: "Profesional <Nombre>",
      especialidad: "Clínica",
      token: "token-solo-de-prueba",
      turnoId: "turno-prueba",
      claveEnvio: "licencia/prueba/turno-prueba",
    }),
    { enviado: true, canal: "email" },
  );
  assert.equal(recibidos.length, 1);
  assert.match(recibidos[0].text || "", /debe ser reprogramado/);
  assert.match(
    recibidos[0].text || "",
    /\/mi-turno\/token-solo-de-prueba\?reprogramar=turno-prueba/,
  );
  assert.match(recibidos[0].html || "", /Paciente &lt;Prueba&gt;/);
  assert.match(recibidos[0].html || "", /Profesional &lt;Nombre&gt;/);
});
