-- Treinamentos: a configuração do teste do Lab.
--
-- Aditiva. Duas tabelas no schema "treinamentos":
--   1. regra_publico: nível de governança + área -> público do teste. Editável pela configuração
--      (ADMIN e DEV). Os padrões da seção "Criação de contas" entram como linhas iniciais.
--   2. teste_config: quantos cenários compõem o teste de cada público (e, se quiser, de uma turma).
--      Sem linha, vale o padrão do ambiente (LAB_TESTE_CENARIOS, 3).

-- 1. regra_publico -------------------------------------------------------------------------
CREATE TABLE "treinamentos"."regra_publico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Nulo = qualquer nível / qualquer área.
    "nivel" TEXT,
    "area_id" UUID,
    "publico" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterado_por" UUID,

    CONSTRAINT "regra_publico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "regra_publico_area_id_idx" ON "treinamentos"."regra_publico"("area_id");

ALTER TABLE "treinamentos"."regra_publico"
    ADD CONSTRAINT "regra_publico_area_id_fkey" FOREIGN KEY ("area_id")
        REFERENCES "public"."Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ck_regra_publico_nivel" CHECK (
        "nivel" IS NULL OR "nivel" IN ('assistente', 'supervisor', 'coordenador', 'diretoria')
    ),
    ADD CONSTRAINT "ck_regra_publico_publico" CHECK (
        "publico" IN ('supervisor-manutencao-adm', 'coordenador-administrativo', 'rh', 'administrativo-geral')
    ),
    -- Uma regra sem nível e sem área valeria para todo mundo: não é regra, é o padrão do código.
    ADD CONSTRAINT "ck_regra_publico_alguma_condicao" CHECK ("nivel" IS NOT NULL OR "area_id" IS NOT NULL);

-- Padrões (iguais aos do código: packages/shared, publicoDoCadastro).
INSERT INTO "treinamentos"."regra_publico" ("nivel", "area_id", "publico")
SELECT r.nivel, (SELECT "id" FROM "public"."Area" WHERE "slug" = r.area), r.publico
FROM (VALUES
    (NULL,          'rh',             'rh'),
    ('supervisor',  'manutencao',     'supervisor-manutencao-adm'),
    ('supervisor',  'administrativo', 'supervisor-manutencao-adm'),
    ('coordenador', 'administrativo', 'coordenador-administrativo'),
    ('assistente',  NULL,             'administrativo-geral'),
    ('supervisor',  NULL,             'supervisor-manutencao-adm'),
    ('coordenador', NULL,             'coordenador-administrativo'),
    ('diretoria',   NULL,             'coordenador-administrativo')
) AS r(nivel, area, publico)
WHERE r.area IS NULL OR EXISTS (SELECT 1 FROM "public"."Area" WHERE "slug" = r.area);

-- 2. teste_config --------------------------------------------------------------------------
CREATE TABLE "treinamentos"."teste_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publico" TEXT NOT NULL,
    -- Nulo = vale para o público inteiro; preenchido = só para essa turma do Lab (tem prioridade).
    "turma_id" UUID,
    "quantidade" SMALLINT NOT NULL,
    "alterado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterado_por" UUID,

    CONSTRAINT "teste_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teste_config_publico_turma_key"
    ON "treinamentos"."teste_config"("publico", COALESCE("turma_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX "teste_config_turma_id_idx" ON "treinamentos"."teste_config"("turma_id");

ALTER TABLE "treinamentos"."teste_config"
    ADD CONSTRAINT "teste_config_turma_id_fkey" FOREIGN KEY ("turma_id")
        REFERENCES "leadership_lab"."turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ck_teste_config_publico" CHECK (
        "publico" IN ('supervisor-manutencao-adm', 'coordenador-administrativo', 'rh', 'administrativo-geral')
    ),
    ADD CONSTRAINT "ck_teste_config_quantidade" CHECK ("quantidade" BETWEEN 1 AND 10);

-- 3. cenario.publico -------------------------------------------------------------------------
-- O público do cenário (o da versão mais recente), para a lista da configuração filtrar sem ler o JSON.
ALTER TABLE "treinamentos"."cenario" ADD COLUMN "publico" TEXT;
UPDATE "treinamentos"."cenario" c SET "publico" = (
    SELECT v."conteudo"->>'publico' FROM "treinamentos"."cenario_versao" v
     WHERE v."cenario_id" = c."id" ORDER BY v."numero" DESC LIMIT 1);
ALTER TABLE "treinamentos"."cenario" ADD CONSTRAINT "ck_cenario_publico" CHECK (
    "publico" IS NULL OR "publico" IN
        ('supervisor-manutencao-adm', 'coordenador-administrativo', 'rh', 'administrativo-geral')
);
