import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHmac,
  createPrivateKey,
  privateDecrypt,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { fechaClinica, sumarDias } from "@/lib/fecha";

// Este módulo no consulta la base de datos ni envía notificaciones.
const especialidades = [
  { id: "general_demo", title: "Medicina general (prueba)" },
  { id: "cardiologia_demo", title: "Cardiología (prueba)" },
];
const profesionales = [
  {
    id: "profesional_demo_a",
    title: "Profesional de prueba A",
    especialidad: "general_demo",
  },
  {
    id: "profesional_demo_b",
    title: "Profesional de prueba B",
    especialidad: "cardiologia_demo",
  },
];
const seleccionSchema = z.object({
  department: z.string().max(50),
  location: z.string().max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{6,30}$/),
});
const solicitudSchema = z.object({
  action: z.enum(["ping", "INIT", "data_exchange"]),
  screen: z.string().max(30).optional(),
  flow_token: z.string().min(1).max(1024).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
class ErrorDemo extends Error {
  constructor(public status: number) {
    super("Solicitud de prueba inválida");
  }
}

function fechas(desde: string) {
  return [1, 2, 3].map((dias) => {
    const id = sumarDias(desde, dias);
    return {
      id,
      title: new Date(`${id}T12:00:00Z`).toLocaleDateString("es-AR", {
        timeZone: "UTC",
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    };
  });
}
function horarios(dia: string) {
  const martes = new Date(`${dia}T12:00:00Z`).getUTCDay() === 2;
  return [
    "09:00",
    "09:30",
    "10:30",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
  ]
    .filter((h) => !martes || h < "15:00" || h >= "17:00")
    .map((id) => ({ id, title: id }));
}

export function respuestaFlowDemo(
  valor: unknown,
  hoy = fechaClinica(),
): object {
  const parsed = solicitudSchema.safeParse(valor);
  if (!parsed.success) throw new ErrorDemo(400);
  const { action, data, screen, flow_token } = parsed.data;
  if (action === "ping") return { data: { status: "active" } };
  if (data.error) return { data: { acknowledged: true } };
  const disponibles = fechas(hoy);
  const especialidad = especialidades.find((e) => e.id === data.department);
  const medicos = profesionales.filter(
    (p) => p.especialidad === especialidad?.id,
  );
  const medico = medicos.find((p) => p.id === data.location);
  const fecha = medico && disponibles.find((d) => d.id === data.date);
  const turno = fecha && horarios(fecha.id).find((h) => h.id === data.time);
  if (
    action === "INIT" ||
    (action === "data_exchange" && screen === "APPOINTMENT")
  ) {
    const inicial = action === "INIT";
    const trigger = inicial ? "" : data.trigger;
    const tieneMedico =
      !inicial && trigger !== "department_selected" && !!medico;
    const tieneFecha =
      tieneMedico && trigger !== "location_selected" && !!fecha;
    return {
      screen: "APPOINTMENT",
      data: {
        department: especialidades,
        location: inicial
          ? []
          : medicos.map(({ id, title }) => ({ id, title })),
        is_location_enabled: !inicial && !!especialidad,
        date: tieneMedico ? disponibles : [],
        is_date_enabled: tieneMedico,
        time: tieneFecha && fecha ? horarios(fecha.id) : [],
        is_time_enabled: tieneFecha,
      },
    };
  }
  const seleccion = seleccionSchema.safeParse(data);
  if (!seleccion.success || !especialidad || !medico || !fecha || !turno)
    throw new ErrorDemo(400);
  if (screen === "DETAILS") {
    const s = seleccion.data;
    return {
      screen: "SUMMARY",
      data: {
        ...s,
        appointment: `${especialidad.title} · ${medico.title}\n${fecha.title} · ${turno.title}\nDemostración sin reserva real.`,
        details: `${s.name}\n${s.email}\n${s.phone}`,
      },
    };
  }
  if (screen === "SUMMARY" && flow_token)
    return {
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: { flow_token, mode: "demo", booking_created: "false" },
        },
      },
    };
  throw new ErrorDemo(400);
}

const base64 = z
  .string()
  .min(4)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const sobreSchema = z.object({
  encrypted_aes_key: base64.max(1500),
  encrypted_flow_data: base64.max(14000),
  initial_vector: base64.max(24),
});
const LIMITE_BYTES = 16384;
async function leerCuerpo(request: Request) {
  if (!request.body) throw new ErrorDemo(400);
  if (Number(request.headers.get("content-length")) > LIMITE_BYTES)
    throw new ErrorDemo(413);
  const lector = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_BYTES) {
        await lector.cancel();
        throw new ErrorDemo(413);
      }
      partes.push(value);
    }
    return Buffer.concat(partes);
  } finally {
    lector.releaseLock();
  }
}

// Protocolo de Meta: RSA-OAEP/SHA-256, AES-128-GCM y vector invertido al responder.
export async function atenderFlowDemo(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Type": "text/plain; charset=utf-8",
  };
  if (process.env.WHATSAPP_FLOW_DEMO_ENABLED !== "true")
    return new Response(null, { status: 404, headers });
  const privada = process.env.WHATSAPP_FLOW_DEMO_PRIVATE_KEY_BASE64?.trim();
  const secreto = process.env.WHATSAPP_FLOW_DEMO_APP_SECRET?.trim();
  if (!privada || !secreto) return new Response(null, { status: 503, headers });
  try {
    const firma = request.headers.get("x-hub-signature-256") ?? "";
    if (!/^sha256=[a-fA-F0-9]{64}$/.test(firma)) throw new ErrorDemo(432);
    const cuerpo = await leerCuerpo(request);
    const esperada = createHmac("sha256", secreto).update(cuerpo).digest();
    if (!timingSafeEqual(esperada, Buffer.from(firma.slice(7), "hex")))
      throw new ErrorDemo(432);
    const sobre = sobreSchema.safeParse(JSON.parse(cuerpo.toString("utf8")));
    if (!sobre.success) throw new ErrorDemo(400);
    const iv = Buffer.from(sobre.data.initial_vector, "base64");
    const cifrado = Buffer.from(sobre.data.encrypted_flow_data, "base64");
    if (![12, 16].includes(iv.length) || cifrado.length <= 16)
      throw new ErrorDemo(400);
    let clave: Buffer;
    try {
      const key = createPrivateKey(
        Buffer.from(privada, "base64").toString("utf8"),
      );
      clave = privateDecrypt(
        { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        Buffer.from(sobre.data.encrypted_aes_key, "base64"),
      );
      if (clave.length !== 16) throw new Error("Clave inválida");
    } catch {
      throw new ErrorDemo(421);
    }
    const descifrador = createDecipheriv("aes-128-gcm", clave, iv);
    descifrador.setAuthTag(cifrado.subarray(-16));
    let datos: unknown;
    try {
      datos = JSON.parse(
        Buffer.concat([
          descifrador.update(cifrado.subarray(0, -16)),
          descifrador.final(),
        ]).toString("utf8"),
      );
    } catch {
      throw new ErrorDemo(400);
    }
    const respuesta = respuestaFlowDemo(datos);
    const inverso = Buffer.from(iv.map((b) => b ^ 255));
    const cifrador = createCipheriv("aes-128-gcm", clave, inverso);
    const salida = Buffer.concat([
      cifrador.update(JSON.stringify(respuesta), "utf8"),
      cifrador.final(),
      cifrador.getAuthTag(),
    ]).toString("base64");
    return new Response(salida, { headers });
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof ErrorDemo
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : 500,
      headers,
    });
  }
}
