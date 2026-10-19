BEGIN;
-- Mantener la asignación de cada médico, adaptando los tonos anteriores.
UPDATE "Medico" SET color = CASE lower(color)
  WHEN '#0f766e' THEN '#187e77'
  WHEN '#7c3aed' THEN '#526f88'
  WHEN '#c2410c' THEN '#a27c5c'
  WHEN '#1d4ed8' THEN '#658b70'
  WHEN '#be185d' THEN '#927383'
  WHEN '#15803d' THEN '#426b62'
  WHEN '#a16207' THEN '#94864d'
  WHEN '#0e7490' THEN '#4e8b9b'
  WHEN '#6d28d9' THEN '#73718e'
  WHEN '#b91c1c' THEN '#a66c62'
  WHEN '#4d7c0f' THEN '#79875b'
  WHEN '#4338ca' THEN '#475f72'
  ELSE color END;
ALTER TABLE "Medico" ALTER COLUMN color SET DEFAULT '#187e77';
COMMIT;
