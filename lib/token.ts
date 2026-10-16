import crypto from "node:crypto";

// Token de acceso personal del paciente (sin login).
export function generarToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Hash determinístico (SHA-256) para poder BUSCAR por el token que llega en
// la URL (where tokenAccesoHash = hash). No sirve para recuperarlo.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function claveCifrado(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("Falta TOKEN_ENCRYPTION_KEY en las variables de entorno");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY debe ser 32 bytes en base64");
  return key;
}

// Copia cifrada (AES-256-GCM) para poder reenviar el MISMO link si el
// paciente lo pierde ("recuperar mi acceso"), sin generar uno nuevo.
export function encriptarToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", claveCifrado(), iv);
  const cifrado = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, cifrado]).toString("base64");
}

export function desencriptarToken(enc: string): string {
  const datos = Buffer.from(enc, "base64");
  const iv = datos.subarray(0, 12);
  const tag = datos.subarray(12, 28);
  const cifrado = datos.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", claveCifrado(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
}
