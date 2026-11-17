-- Desfaz 0020_assistente_de_suporte. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql). Apaga as linhas de log do assistente de suporte (só
-- metadados de chamadas), que a restrição antiga não aceitaria.
BEGIN;
DELETE FROM "leadership_lab"."log_ia" WHERE "agente" = 'suporte';
ALTER TABLE "leadership_lab"."log_ia" DROP CONSTRAINT "ck_log_ia_agente";
ALTER TABLE "leadership_lab"."log_ia"
  ADD CONSTRAINT "ck_log_ia_agente" CHECK ("agente" IN ('agente_lab', 'guarda', 'autor', 'analista', 'agente_forms', 'facilitador'));
COMMIT;
