-- Desfaz 0019_leadership_lab_base_pedagogica. O Prisma Migrate não aplica este arquivo: rode-o à
-- mão (psql -v ON_ERROR_STOP=1 -f down.sql). Apaga só as colunas da base pedagógica (metadados).
BEGIN;
ALTER TABLE "leadership_lab"."resultado" DROP COLUMN "experimental";
ALTER TABLE "leadership_lab"."turno"
  DROP CONSTRAINT "ck_turno_fundamentacao",
  DROP COLUMN "fundamentacao",
  DROP COLUMN "base_pedagogica";
ALTER TABLE "leadership_lab"."sessao"
  DROP CONSTRAINT "ck_sessao_dificuldade",
  DROP COLUMN "dificuldade",
  DROP COLUMN "rubrica_versao";
COMMIT;
