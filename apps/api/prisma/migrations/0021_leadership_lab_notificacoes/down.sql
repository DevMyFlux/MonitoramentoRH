-- Desfaz 0021_leadership_lab_notificacoes. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql). Só apaga as marcações de leitura; as notificações são
-- derivadas e voltam a aparecer como não lidas se a migração subir de novo.
DROP TABLE "leadership_lab"."notificacao_leitura";
