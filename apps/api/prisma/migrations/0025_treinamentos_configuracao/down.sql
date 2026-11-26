-- Desfaz 0025_treinamentos_configuracao. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql). Apaga as regras de público e as quantidades configuradas
-- (o teste volta aos padrões do código e do ambiente).
ALTER TABLE "treinamentos"."cenario" DROP CONSTRAINT "ck_cenario_publico", DROP COLUMN "publico";
DROP TABLE "treinamentos"."teste_config";
DROP TABLE "treinamentos"."regra_publico";
