import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@sistema-clinica.com";
  const existente = await prisma.usuarioInterno.findUnique({ where: { email } });
  if (existente) {
    console.log(`Ya existe un usuario admin con email ${email}, no se crea de nuevo.`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.usuarioInterno.create({
    data: {
      nombre: "Administrador",
      email,
      password: passwordHash,
      rol: "ADMIN",
      activo: true,
    },
  });

  console.log("Usuario admin creado:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log("Guardá esta contraseña, no se vuelve a mostrar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
