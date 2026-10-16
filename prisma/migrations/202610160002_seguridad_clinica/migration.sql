BEGIN;
-- La migración no fusiona ni descarta identidades. Ante ambigüedad,
-- se detiene antes de tocar datos para que secretaría resuelva los casos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Paciente" WHERE regexp_replace("dni", '[.[:space:]-]', '', 'g') !~ '^[0-9]{6,9}$') THEN
    RAISE EXCEPTION 'Hay documentos inválidos. Ejecutar db:preflight y corregir antes de migrar.';
  END IF;
  IF EXISTS (SELECT 1 FROM "Paciente" GROUP BY regexp_replace("dni", '[.[:space:]-]', '', 'g') HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay DNI equivalentes. Resolver identidades duplicadas antes de migrar.';
  END IF;
  IF EXISTS (SELECT 1 FROM "UsuarioInterno" GROUP BY lower(trim("email")) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay emails internos equivalentes. Resolver duplicados antes de migrar.';
  END IF;
END $$;
UPDATE "Paciente" SET "dni" = regexp_replace("dni", '[.[:space:]-]', '', 'g');
UPDATE "Paciente" SET "email" = lower(trim("email")) WHERE "email" IS NOT NULL;
UPDATE "UsuarioInterno" SET "email" = lower(trim("email"));
CREATE UNIQUE INDEX "UsuarioInterno_email_normalizado_key" ON "UsuarioInterno" (lower(trim("email")));

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "versionFicha" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Turno" ADD COLUMN     "recordatorioError" TEXT,
ADD COLUMN     "recordatorioIntentadoEl" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "anuladoEl" TIMESTAMP(3),
ADD COLUMN     "anuladoPor" TEXT,
ADD COLUMN     "motivoAnulacion" TEXT;

-- CreateTable
CREATE TABLE "VerificacionPaciente" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "pacienteId" TEXT,
    "email" TEXT,
    "proposito" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "consumidoEl" TIMESTAMP(3),
    "venceEl" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificacionPaciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimiteSolicitud" (
    "clave" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "venceEl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LimiteSolicitud_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "RevisionFicha" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "realizadoPor" TEXT NOT NULL,
    "anterior" JSONB NOT NULL,
    "posterior" JSONB NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionFicha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionNota" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "realizadoPor" TEXT NOT NULL,
    "anterior" TEXT,
    "posterior" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionNota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificacionPaciente_venceEl_idx" ON "VerificacionPaciente"("venceEl");

-- CreateIndex
CREATE INDEX "LimiteSolicitud_venceEl_idx" ON "LimiteSolicitud"("venceEl");

-- CreateIndex
CREATE INDEX "RevisionFicha_pacienteId_fecha_idx" ON "RevisionFicha"("pacienteId", "fecha");

-- CreateIndex
CREATE INDEX "RevisionNota_turnoId_fecha_idx" ON "RevisionNota"("turnoId", "fecha");

-- AddForeignKey
ALTER TABLE "RevisionFicha" ADD CONSTRAINT "RevisionFicha_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionNota" ADD CONSTRAINT "RevisionNota_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reconciliar el contador heredado sin permitir valores negativos.
UPDATE "Paciente" p SET "ausenciasSinAviso" = (SELECT count(*) FROM "Turno" t WHERE t."pacienteId" = p.id AND t.estado = 'AUSENTE');
-- Conservar el contenido clínico preexistente como primera revisión.
INSERT INTO "RevisionNota" (id, "turnoId", version, "realizadoPor", anterior, posterior, fecha)
SELECT 'baseline-nota-' || id, id, version, 'migracion:contenido-previo', NULL, "notasMedico", "updatedAt" FROM "Turno" WHERE "notasMedico" IS NOT NULL;
INSERT INTO "RevisionFicha" (id, "pacienteId", version, "realizadoPor", anterior, posterior, fecha)
SELECT 'baseline-ficha-' || id, id, 0, 'migracion:contenido-previo', '{}'::jsonb,
jsonb_build_object('pesoKg', "pesoKg", 'alturaCm', "alturaCm", 'grupoSanguineo', "grupoSanguineo", 'alergias', alergias, 'antecedentes', antecedentes), "updatedAt"
FROM "Paciente";
CREATE INDEX "Pago_anuladoEl_idx" ON "Pago"("anuladoEl");

-- El acceso se realiza desde el backend propietario de las tablas, nunca desde roles públicos.
ALTER TABLE "Paciente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Especialidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Medico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HorarioMedico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BloqueoMedico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Turno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HistorialTurno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pago" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsuarioInterno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificacionPaciente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LimiteSolicitud" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionFicha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionNota" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON TABLE "Paciente", "Especialidad", "Medico", "HorarioMedico", "BloqueoMedico", "Turno", "HistorialTurno", "Pago", "UsuarioInterno", "VerificacionPaciente", "LimiteSolicitud", "RevisionFicha", "RevisionNota" FROM %I', rol);
    END IF;
  END LOOP;
END $$;

COMMIT;
