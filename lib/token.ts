import crypto from "node:crypto";

// Token de acceso personal del paciente (sin login). Se entrega en texto
// plano por el link; en la base solo se guarda el hash, igual que una
// contraseña. Como el token ES la clave de búsqueda, se usa un hash
// determinístico (SHA-256) en vez de bcrypt, para poder buscar por igualdad.
export function generarToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
