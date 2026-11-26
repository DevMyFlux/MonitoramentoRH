-- Desfaz 0024_lab_teste_cenarios. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql).
-- ATENÇÃO: apaga as trilhas de cenários (tentativas e respostas) e as sessões do modo "cenarios",
-- com os resultados delas. Faça backup antes. As sessões do modo "dinamico" não são tocadas.

DROP TRIGGER "trg_resposta_cenario_imutavel" ON "leadership_lab"."resposta_cenario";
DROP TRIGGER "trg_resposta_cenario_em_andamento" ON "leadership_lab"."resposta_cenario";
DROP FUNCTION "leadership_lab"."resposta_cenario_imutavel"();
DROP FUNCTION "leadership_lab"."resposta_cenario_exige_em_andamento"();
DROP TABLE "leadership_lab"."resposta_cenario";
DROP TABLE "leadership_lab"."tentativa_cenario";

-- As sessões do modo "cenarios" não cabem mais no CHECK antigo: saem junto com o que dependia delas.
DELETE FROM "leadership_lab"."contestacao" WHERE "resultado_id" IN (
    SELECT r."id" FROM "leadership_lab"."resultado" r
    JOIN "leadership_lab"."sessao" s ON s."id" = r."sessao_id" WHERE s."modo" = 'cenarios');
DELETE FROM "leadership_lab"."resultado" WHERE "sessao_id" IN (
    SELECT "id" FROM "leadership_lab"."sessao" WHERE "modo" = 'cenarios');
DELETE FROM "leadership_lab"."log_ia" WHERE "sessao_id" IN (
    SELECT "id" FROM "leadership_lab"."sessao" WHERE "modo" = 'cenarios');
DELETE FROM "leadership_lab"."sessao" WHERE "modo" = 'cenarios';

DROP INDEX "leadership_lab"."sessao_origem_idx";
ALTER TABLE "leadership_lab"."sessao"
    DROP CONSTRAINT "ck_sessao_publico_so_em_cenarios",
    DROP CONSTRAINT "ck_sessao_publico",
    DROP COLUMN "publico",
    DROP CONSTRAINT "ck_sessao_origem",
    DROP COLUMN "origem",
    DROP CONSTRAINT "ck_sessao_modo";
ALTER TABLE "leadership_lab"."sessao"
    ADD CONSTRAINT "ck_sessao_modo" CHECK ("modo" IN ('dinamico'));
