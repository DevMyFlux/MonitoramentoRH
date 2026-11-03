-- Desfaz 0016_leadership_lab_engine. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql). Não apaga dados do Lab: só remove a reserva dos
-- turnos e a restrição de uma sessão em andamento por participante.
BEGIN;

ALTER TABLE "leadership_lab"."turno" DROP COLUMN IF EXISTS "processando_ate";
DROP INDEX IF EXISTS "leadership_lab"."ux_sessao_em_andamento_por_participante";

COMMIT;
