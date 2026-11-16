import assert from "node:assert/strict";
import { test, after } from "node:test";
import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHmac,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { POST } from "../app/api/whatsapp/flows/prueba/route";
import { respuestaFlowDemo } from "../lib/whatsapp-flow-demo";

const claves = generateKeyPairSync("rsa", { modulusLength: 2048 });
const secreto = "secreto-sintetico-para-pruebas-de-flow";
const nombres = [
  "WHATSAPP_FLOW_DEMO_ENABLED",
  "WHATSAPP_FLOW_DEMO_PRIVATE_KEY_BASE64",
  "WHATSAPP_FLOW_DEMO_APP_SECRET",
] as const;
const anteriores = Object.fromEntries(nombres.map((n) => [n, process.env[n]]));
function configurar() {
  process.env.WHATSAPP_FLOW_DEMO_ENABLED = "true";
  process.env.WHATSAPP_FLOW_DEMO_APP_SECRET = secreto;
  process.env.WHATSAPP_FLOW_DEMO_PRIVATE_KEY_BASE64 = Buffer.from(
    claves.privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  ).toString("base64");
}
after(() => {
  for (const n of nombres) {
    if (anteriores[n] === undefined) delete process.env[n];
    else process.env[n] = anteriores[n];
  }
});
function preparar(datos: object) {
  const aes = randomBytes(16),
    iv = randomBytes(16);
  const cipher = createCipheriv("aes-128-gcm", aes, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(datos), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const cuerpo = JSON.stringify({
    encrypted_aes_key: publicEncrypt(
      {
        key: claves.publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aes,
    ).toString("base64"),
    encrypted_flow_data: encrypted.toString("base64"),
    initial_vector: iv.toString("base64"),
  });
  return { aes, iv, cuerpo };
}
function solicitar(
  cuerpo: string,
  firma = createHmac("sha256", secreto).update(cuerpo).digest("hex"),
) {
  return new Request("https://example.test/api/whatsapp/flows/prueba", {
    method: "POST",
    body: cuerpo,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${firma}`,
    },
  });
}
async function intercambiar(datos: object) {
  const p = preparar(datos);
  const r = await POST(solicitar(p.cuerpo));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control")!, /no-store/);
  assert.match(r.headers.get("content-type")!, /text\/plain/);
  const cifrado = Buffer.from(await r.text(), "base64");
  const d = createDecipheriv(
    "aes-128-gcm",
    p.aes,
    Buffer.from(p.iv.map((b) => b ^ 255)),
  );
  d.setAuthTag(cifrado.subarray(-16));
  return JSON.parse(
    Buffer.concat([d.update(cifrado.subarray(0, -16)), d.final()]).toString(
      "utf8",
    ),
  );
}

test("el extremo de prueba permanece cerrado sin activación o sin credenciales completas", async () => {
  configurar();
  process.env.WHATSAPP_FLOW_DEMO_ENABLED = "false";
  assert.equal((await POST(solicitar("{}"))).status, 404);
  process.env.WHATSAPP_FLOW_DEMO_ENABLED = "true";
  delete process.env.WHATSAPP_FLOW_DEMO_APP_SECRET;
  assert.equal((await POST(solicitar("{}"))).status, 503);
  configurar();
  delete process.env.WHATSAPP_FLOW_DEMO_PRIVATE_KEY_BASE64;
  assert.equal((await POST(solicitar("{}"))).status, 503);
});
test("Meta recibe la comprobación de estado cifrada y el inicio sin datos de pacientes", async () => {
  configurar();
  assert.deepEqual(await intercambiar({ action: "ping" }), {
    data: { status: "active" },
  });
  const inicio = await intercambiar({ action: "INIT" });
  assert.equal(inicio.screen, "APPOINTMENT");
  assert.equal(inicio.data.is_location_enabled, false);
  assert.deepEqual(inicio.data.location, []);
  assert(
    inicio.data.department.every((e: { id: string }) => e.id.endsWith("_demo")),
  );
  assert.deepEqual(
    await intercambiar({
      action: "data_exchange",
      data: { error: "error-de-prueba" },
    }),
    { data: { acknowledged: true } },
  );
});
test("la reserva demostrativa filtra profesionales, habilita campos en orden y termina sin crear una cita", async () => {
  configurar();
  const base = {
    action: "data_exchange",
    screen: "APPOINTMENT",
    flow_token: "sesion-demostrativa",
  };
  const a = await intercambiar({
    ...base,
    data: { department: "general_demo", trigger: "department_selected" },
  });
  assert.deepEqual(
    a.data.location.map((m: { id: string }) => m.id),
    ["profesional_demo_a"],
  );
  assert.equal(a.data.is_date_enabled, false);
  const b = await intercambiar({
    ...base,
    data: {
      department: "general_demo",
      location: "profesional_demo_a",
      trigger: "location_selected",
    },
  });
  assert.equal(b.data.date.length, 3);
  assert.equal(b.data.is_time_enabled, false);
  const date = b.data.date[0].id;
  const c = await intercambiar({
    ...base,
    data: {
      department: "general_demo",
      location: "profesional_demo_a",
      date,
      trigger: "date_selected",
    },
  });
  assert.equal(c.data.is_time_enabled, true);
  const data = {
    department: "general_demo",
    location: "profesional_demo_a",
    date,
    time: c.data.time[0].id,
    name: "Persona ficticia",
    email: "persona@example.test",
    phone: "5491100000000",
    dato_extra: "NO_PROPAGAR",
  };
  const resumen = await intercambiar({ ...base, screen: "DETAILS", data });
  assert.equal(resumen.screen, "SUMMARY");
  assert.match(resumen.data.appointment, /sin reserva real/);
  assert(!JSON.stringify(resumen).includes("NO_PROPAGAR"));
  const fin = await intercambiar({ ...base, screen: "SUMMARY", data });
  assert.deepEqual(fin, {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: "sesion-demostrativa",
          mode: "demo",
          booking_created: "false",
        },
      },
    },
  });
  assert(!JSON.stringify(fin).includes(data.email));
});
test("el ejemplo de ausencia del martes excluye todos los turnos entre 15 y 17 y rechaza selecciones manipuladas", () => {
  const data = {
    department: "general_demo",
    location: "profesional_demo_a",
    date: "2026-11-17",
    trigger: "date_selected",
  };
  const r = respuestaFlowDemo(
    { action: "data_exchange", screen: "APPOINTMENT", data },
    "2026-11-16",
  ) as { data: { time: { id: string }[] } };
  assert(r.data.time.some((t) => t.id === "14:30"));
  assert(r.data.time.some((t) => t.id === "17:00"));
  assert(!r.data.time.some((t) => t.id >= "15:00" && t.id < "17:00"));
  const seleccion = {
    ...data,
    name: "Prueba",
    email: "persona@example.test",
    phone: "5491100000000",
    time: "15:30",
  };
  assert.throws(() =>
    respuestaFlowDemo(
      { action: "data_exchange", screen: "DETAILS", data: seleccion },
      "2026-11-16",
    ),
  );
  assert.throws(() =>
    respuestaFlowDemo(
      {
        action: "data_exchange",
        screen: "DETAILS",
        data: { ...seleccion, time: "09:00", location: "profesional_demo_b" },
      },
      "2026-11-16",
    ),
  );
  assert.throws(() =>
    respuestaFlowDemo(
      {
        action: "data_exchange",
        screen: "DETAILS",
        data: { ...seleccion, time: "09:00", date: "2026-01-01" },
      },
      "2026-11-16",
    ),
  );
});
test("firma ausente, falsa o contenido cambiado se rechazan antes del descifrado", async () => {
  configurar();
  const p = preparar({ action: "INIT" });
  assert.equal(
    (
      await POST(
        new Request("https://example.test", { method: "POST", body: p.cuerpo }),
      )
    ).status,
    432,
  );
  assert.equal((await POST(solicitar(p.cuerpo, "0".repeat(64)))).status, 432);
  const firma = createHmac("sha256", secreto).update(p.cuerpo).digest("hex");
  assert.equal((await POST(solicitar(p.cuerpo + " ", firma))).status, 432);
});
test("claves incompatibles y datos cifrados adulterados no devuelven contenido ni secretos", async () => {
  configurar();
  const p = preparar({ action: "INIT" });
  const mal = JSON.parse(p.cuerpo);
  mal.encrypted_aes_key = randomBytes(256).toString("base64");
  const rsa = await POST(solicitar(JSON.stringify(mal)));
  assert.equal(rsa.status, 421);
  assert.equal(await rsa.text(), "");
  const cuerpo = JSON.parse(p.cuerpo);
  const cifrado = Buffer.from(cuerpo.encrypted_flow_data, "base64");
  cifrado[0] ^= 1;
  cuerpo.encrypted_flow_data = cifrado.toString("base64");
  const aes = await POST(solicitar(JSON.stringify(cuerpo)));
  assert.equal(aes.status, 400);
  assert.equal(await aes.text(), "");
  assert.equal((await POST(solicitar("{"))).status, 400);
});
test("la lectura del cuerpo impone un límite aun sin Content-Length", async () => {
  configurar();
  assert.equal((await POST(solicitar("x".repeat(16385)))).status, 413);
});
