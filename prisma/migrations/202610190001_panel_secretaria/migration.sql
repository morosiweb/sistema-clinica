BEGIN;

ALTER TABLE "Medico" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#0f766e';
WITH colores AS (
  SELECT id, (row_number() OVER (ORDER BY "createdAt", id) - 1)::int AS numero
  FROM "Medico"
)
UPDATE "Medico" m SET color = (ARRAY['#0f766e','#7c3aed','#c2410c','#1d4ed8','#be185d','#15803d','#a16207','#0e7490','#6d28d9','#b91c1c','#4d7c0f','#4338ca'])[1 + colores.numero % 12]
FROM colores WHERE m.id = colores.id;
ALTER TABLE "Medico" ADD CONSTRAINT "Medico_color_valido" CHECK (color ~ '^#[0-9a-fA-F]{6}$');

CREATE TABLE "NotaPaciente" (
  id TEXT PRIMARY KEY,
  "pacienteId" TEXT NOT NULL REFERENCES "Paciente"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  contenido TEXT NOT NULL,
  "autorId" TEXT NOT NULL REFERENCES "UsuarioInterno"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "NotaPaciente_pacienteId_createdAt_idx" ON "NotaPaciente"("pacienteId", "createdAt");

CREATE TABLE "ArchivoPaciente" (
  id TEXT PRIMARY KEY,
  "pacienteId" TEXT NOT NULL REFERENCES "Paciente"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanio INTEGER NOT NULL CHECK (tamanio BETWEEN 1 AND 3145728),
  contenido BYTEA NOT NULL,
  "autorId" TEXT NOT NULL REFERENCES "UsuarioInterno"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArchivoPaciente_tamanio_contenido" CHECK (octet_length(contenido) = tamanio)
);
CREATE INDEX "ArchivoPaciente_pacienteId_createdAt_idx" ON "ArchivoPaciente"("pacienteId", "createdAt");

ALTER TABLE "NotaPaciente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArchivoPaciente" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE rol TEXT;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON TABLE "NotaPaciente", "ArchivoPaciente" FROM %I', rol);
    END IF;
  END LOOP;
END $$;

COMMIT;
