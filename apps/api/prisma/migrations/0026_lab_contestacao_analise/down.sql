-- Desfaz 0026_lab_contestacao_analise. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql). Contestações "em análise" voltam a "pendente" e a marca de
-- deferimento dos resultados se perde (a decisão em si continua na contestação).
ALTER TABLE "leadership_lab"."resultado" DROP COLUMN "contestacao_deferida_em";
UPDATE "leadership_lab"."contestacao" SET "status" = 'pendente' WHERE "status" = 'em_analise';
ALTER TABLE "leadership_lab"."contestacao"
  DROP CONSTRAINT "ck_contestacao_analise",
  DROP CONSTRAINT "ck_contestacao_justificativa",
  DROP CONSTRAINT "ck_contestacao_decisao",
  DROP CONSTRAINT "ck_contestacao_status",
  ADD CONSTRAINT "ck_contestacao_status" CHECK ("status" IN ('pendente', 'aceita', 'rejeitada')),
  ADD CONSTRAINT "ck_contestacao_decisao" CHECK (
    CASE WHEN "status" = 'pendente'
      THEN "decidido_por" IS NULL AND "decidido_em" IS NULL
      ELSE "decidido_por" IS NOT NULL AND "decidido_em" IS NOT NULL
    END
  );
ALTER TABLE "leadership_lab"."contestacao" DROP COLUMN "analise_em", DROP COLUMN "analise_por";
