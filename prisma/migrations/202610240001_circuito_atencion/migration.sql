ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'LLEGO';
ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'EN_ESPERA';
ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'EN_CONSULTA';
ALTER TABLE "Paciente" ADD COLUMN "versionDatos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsuarioInterno" ADD COLUMN "versionSesion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "RevisionDatosPaciente" (
  "id" TEXT PRIMARY KEY, "pacienteId" TEXT NOT NULL REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL, "realizadoPor" TEXT NOT NULL,
  "anterior" JSONB NOT NULL, "posterior" JSONB NOT NULL, "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RevisionDatosPaciente_pacienteId_fecha_idx" ON "RevisionDatosPaciente"("pacienteId", "fecha");
CREATE TABLE "BorradorClinico" (
  "id" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL REFERENCES "UsuarioInterno"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "pacienteId" TEXT NOT NULL REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "tipo" TEXT NOT NULL, "referenciaId" TEXT NOT NULL,
  "versionBase" INTEGER NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1,
  "contenido" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BorradorClinico_usuarioId_tipo_referenciaId_key" ON "BorradorClinico"("usuarioId", "tipo", "referenciaId");
CREATE TABLE "RecuperacionCuenta" (
  "tokenHash" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL REFERENCES "UsuarioInterno"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "versionSesion" INTEGER NOT NULL, "venceEl" TIMESTAMP(3) NOT NULL, "consumidoEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RecuperacionCuenta_venceEl_idx" ON "RecuperacionCuenta"("venceEl");
CREATE TABLE "AvisoTurno" (
  "id" TEXT PRIMARY KEY, "turnoId" TEXT NOT NULL REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "tipo" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL, "horaInicio" TEXT NOT NULL, "medicoId" TEXT NOT NULL,
  "enviado" BOOLEAN NOT NULL DEFAULT false, "descartado" BOOLEAN NOT NULL DEFAULT false,
  "intentos" INTEGER NOT NULL DEFAULT 0, "error" TEXT, "canal" TEXT, "intentadoEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AvisoTurno_enviado_descartado_createdAt_idx" ON "AvisoTurno"("enviado", "descartado", "createdAt");
CREATE INDEX "AvisoTurno_turnoId_idx" ON "AvisoTurno"("turnoId");
DO $$
DECLARE tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['RevisionDatosPaciente', 'BorradorClinico', 'RecuperacionCuenta', 'AvisoTurno'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', tabla);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', tabla);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', tabla);
    END IF;
  END LOOP;
END $$;
