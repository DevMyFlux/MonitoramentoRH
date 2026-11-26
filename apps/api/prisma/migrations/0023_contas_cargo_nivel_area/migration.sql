-- Contas de acesso: cargo, nível de governança e área. Migração ADITIVA.
--
-- O que muda:
--   1. Enum "NivelGovernanca" (assistente | supervisor | coordenador | diretoria).
--   2. Tabela "Area" (RH, Administrativo, Compras, Manutenção, Financeiro: dados iniciais; o resto
--      é configurável por DEV e ADMIN na tela de usuários). Nada de DROP em dado existente.
--   3. "User" e "UserInvitation" ganham cargo, nivelGovernanca e areaId, todos OPCIONAIS no banco:
--      as contas antigas ficam como estão e aparecem com o selo "Cadastro incompleto" até alguém
--      completar (é o preenchimento assistido). Para contas NOVAS e ao EDITAR, a API exige os três.
--
-- Para desfazer: down.sql nesta pasta (aplicado à mão; perde o cargo, nível e área já gravados).

-- 1. Enum ----------------------------------------------------------------------

CREATE TYPE "public"."NivelGovernanca" AS ENUM ('assistente', 'supervisor', 'coordenador', 'diretoria');

-- 2. Áreas ---------------------------------------------------------------------

CREATE TABLE "public"."Area" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Area_slug_key" ON "public"."Area"("slug");
-- Dois nomes que só diferem em maiúsculas ("rh" e "RH") não convivem.
CREATE UNIQUE INDEX "Area_nome_lower_key" ON "public"."Area" (lower("nome"));

ALTER TABLE "public"."Area" ADD CONSTRAINT "Area_slug_check"
    CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{0,62}$');
ALTER TABLE "public"."Area" ADD CONSTRAINT "Area_nome_check"
    CHECK (char_length(btrim("nome")) BETWEEN 2 AND 80);

INSERT INTO "public"."Area" ("slug", "nome") VALUES
    ('rh', 'RH'),
    ('administrativo', 'Administrativo'),
    ('compras', 'Compras'),
    ('manutencao', 'Manutenção'),
    ('financeiro', 'Financeiro');

-- 3. Cadastro nas contas e nos convites ------------------------------------------

ALTER TABLE "public"."User"
    ADD COLUMN "cargo" TEXT,
    ADD COLUMN "nivelGovernanca" "public"."NivelGovernanca",
    ADD COLUMN "areaId" UUID;

ALTER TABLE "public"."UserInvitation"
    ADD COLUMN "cargo" TEXT,
    ADD COLUMN "nivelGovernanca" "public"."NivelGovernanca",
    ADD COLUMN "areaId" UUID;

-- Cargo, quando existe, não é vazio nem enorme (NULL continua valendo: contas antigas).
ALTER TABLE "public"."User" ADD CONSTRAINT "User_cargo_check"
    CHECK ("cargo" IS NULL OR char_length(btrim("cargo")) BETWEEN 2 AND 120);
ALTER TABLE "public"."UserInvitation" ADD CONSTRAINT "UserInvitation_cargo_check"
    CHECK ("cargo" IS NULL OR char_length(btrim("cargo")) BETWEEN 2 AND 120);

ALTER TABLE "public"."User" ADD CONSTRAINT "User_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "public"."Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."UserInvitation" ADD CONSTRAINT "UserInvitation_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "public"."Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_areaId_idx" ON "public"."User"("areaId");
