import "dotenv/config";
import { prisma } from "../lib/prisma";
async function main() {
  const pacientes = await prisma.paciente.findMany({
    select: { id: true, dni: true },
  });
  const usuarios = await prisma.usuarioInterno.findMany({
    select: { id: true, email: true },
  });
  const documentos = new Map<string, string[]>(),
    correos = new Map<string, string[]>();
  const invalidos: string[] = [];
  for (const p of pacientes) {
    const dni = p.dni.replace(/[.\s-]/g, "");
    if (!/^\d{6,9}$/.test(dni)) invalidos.push(p.id);
    documentos.set(dni, [...(documentos.get(dni) || []), p.id]);
  }
  for (const u of usuarios) {
    const email = u.email.trim().toLowerCase();
    correos.set(email, [...(correos.get(email) || []), u.id]);
  }
  const duplicadosDni = [...documentos.values()].filter((v) => v.length > 1),
    duplicadosEmail = [...correos.values()].filter((v) => v.length > 1);
  console.log(
    JSON.stringify(
      {
        documentosInvalidos: invalidos,
        identidadesConDniEquivalente: duplicadosDni,
        usuariosConEmailEquivalente: duplicadosEmail,
      },
      null,
      2,
    ),
  );
  if (invalidos.length || duplicadosDni.length || duplicadosEmail.length)
    process.exitCode = 1;
}
main()
  .catch(() => {
    console.error("No se pudo revisar la base configurada");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
