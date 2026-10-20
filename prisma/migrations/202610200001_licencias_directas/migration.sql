BEGIN;
ALTER TABLE "BloqueoMedico" ALTER COLUMN estado SET DEFAULT 'APROBADO';
ALTER TABLE "Turno"
  ADD COLUMN "requiereReprogramacion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reprogramacionId" TEXT,
  ADD COLUMN "avisoReprogramacionEnviado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "avisoReprogramacionError" TEXT,
  ADD COLUMN "avisoReprogramacionIntentadoEl" TIMESTAMP(3);
CREATE INDEX "Turno_requiereReprogramacion_avisoReprogramacionEnviado_idx"
  ON "Turno"("requiereReprogramacion", "avisoReprogramacionEnviado");
COMMIT;
