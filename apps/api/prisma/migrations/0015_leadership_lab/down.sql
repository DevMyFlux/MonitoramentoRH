-- Desfaz 0015_leadership_lab. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql) e depois remova a linha da migração em
-- "_prisma_migrations" se quiser reaplicá-la com `prisma migrate deploy`.
--
-- DESTRUTIVO: apaga todos os dados do Leadership Lab (sessões, resultados, perfis, alertas).
-- Nada fora do schema leadership_lab é alterado: as tabelas do RH em "public" não
-- têm coluna nem FK apontando para o Lab.
--
-- Tudo em uma transação. O schema leadership_lab_ia é removido SEM CASCADE: se o
-- serviço de IA já criou tabelas ali, o DROP falha e nada é desfeito, em vez de
-- apagar as conversas do ADK por tabela.
BEGIN;

DROP SCHEMA IF EXISTS "leadership_lab" CASCADE;
DROP SCHEMA IF EXISTS "leadership_lab_ia";

COMMIT;
