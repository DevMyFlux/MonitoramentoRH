-- Desfaz 0018_leadership_lab_facilitador. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql). Apaga as linhas de log do facilitador, que a restrição
-- antiga não aceitaria (só metadados de chamadas: nenhum conteúdo de conversa é guardado).
BEGIN;
DELETE FROM "leadership_lab"."log_ia" WHERE "agente" = 'facilitador';
ALTER TABLE "leadership_lab"."log_ia" DROP CONSTRAINT "ck_log_ia_agente";
ALTER TABLE "leadership_lab"."log_ia"
  ADD CONSTRAINT "ck_log_ia_agente" CHECK ("agente" IN ('agente_lab', 'guarda', 'autor', 'analista', 'agente_forms'));
COMMIT;
