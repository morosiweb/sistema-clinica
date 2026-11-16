import { generateKeyPairSync } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

async function main() {
  const destino = path.resolve(
    process.argv[2] ||
      path.join(os.homedir(), ".codex", "private", "whatsapp-flow-demo"),
  );
  const publica = path.join(destino, "clave-publica.pem");
  const entorno = path.join(destino, "configuracion-vercel.env");
  for (const archivo of [publica, entorno]) {
    const existe = await access(archivo).then(
      () => true,
      () => false,
    );
    if (existe)
      throw new Error("Ya hay claves en ese destino. No se reemplazaron.");
  }
  const claves = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  await mkdir(destino, { recursive: true, mode: 0o700 });
  await writeFile(
    entorno,
    `WHATSAPP_FLOW_DEMO_ENABLED="true"\nWHATSAPP_FLOW_DEMO_PRIVATE_KEY_BASE64="${Buffer.from(claves.privateKey).toString("base64")}"\nWHATSAPP_FLOW_DEMO_APP_SECRET=""\n`,
    { flag: "wx", mode: 0o600 },
  );
  await writeFile(publica, claves.publicKey, { flag: "wx", mode: 0o600 });
  console.log(`Clave pública para Meta: ${publica}`);
  console.log(`Configuración privada para Vercel: ${entorno}`);
  console.log(
    "Falta completar el secreto de la aplicación de prueba de Meta. No compartas el archivo privado ni lo agregues a Git.",
  );
}
main().catch(() => {
  console.error(
    "No se generaron claves nuevas: revisá que el destino no contenga claves existentes y sea accesible.",
  );
  process.exitCode = 1;
});
