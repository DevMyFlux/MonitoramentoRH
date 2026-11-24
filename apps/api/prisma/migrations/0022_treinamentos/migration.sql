-- Treinamentos Interativos — schema, tabelas e regras de integridade.
--
-- Estrutura:
--   1. Schema.
--   2. Tabelas, índices e chaves estrangeiras (espelham os modelos Treino* do schema.prisma).
--   3. Regras que o Prisma não expressa: CHECK, índice único parcial e gatilhos.
--
-- Reaproveita do Leadership Lab as turmas (leadership_lab.turma) e os participantes
-- (leadership_lab.participante): não há outra gestão de turmas.
--
-- Nada é apagado de verdade: as chaves estrangeiras são RESTRICT e o "apagar" é feito por status.
-- Uma versão aprovada é imutável (gatilho), e só versão aprovada pode ser atribuída (gatilho).
--
-- Para desfazer: down.sql nesta pasta (aplicado à mão).
--
-- Cuidado com NULL nos CHECK: uma expressão NULL é aceita pelo Postgres. Por isso as regras abaixo
-- comparam com IS NULL / IS NOT NULL de forma explícita.

-- 1. Schema --------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS "treinamentos";

-- 2. Tabelas -------------------------------------------------------------------

CREATE TABLE "treinamentos"."cenario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterado_por" UUID,
    "alterado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivado_em" TIMESTAMPTZ(3),

    CONSTRAINT "cenario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cenario_slug_key" ON "treinamentos"."cenario"("slug");

CREATE TABLE "treinamentos"."cenario_versao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cenario_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "conteudo" JSONB NOT NULL,
    "scene_pack" TEXT NOT NULL,
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprovado_por" UUID,
    "aprovado_em" TIMESTAMPTZ(3),

    CONSTRAINT "cenario_versao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cenario_versao_cenario_id_numero_key"
    ON "treinamentos"."cenario_versao"("cenario_id", "numero");

CREATE TABLE "treinamentos"."atribuicao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cenario_versao_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "prazo" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alterado_por" UUID,
    "alterado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atribuicao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "atribuicao_turma_id_idx" ON "treinamentos"."atribuicao"("turma_id");
CREATE INDEX "atribuicao_cenario_versao_id_idx" ON "treinamentos"."atribuicao"("cenario_versao_id");

CREATE TABLE "treinamentos"."tentativa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "atribuicao_id" UUID NOT NULL,
    "participante_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'em_andamento',
    "iniciada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em" TIMESTAMPTZ(3),
    "decisoes" JSONB,
    "resultados" JSONB,
    "validada_por" UUID,
    "validada_em" TIMESTAMPTZ(3),
    "nota_curador" TEXT,
    "alterado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentativa_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tentativa_atribuicao_id_idx" ON "treinamentos"."tentativa"("atribuicao_id");
CREATE INDEX "tentativa_participante_id_idx" ON "treinamentos"."tentativa"("participante_id");

CREATE TABLE "treinamentos"."resposta" (
    "tentativa_id" UUID NOT NULL,
    "pergunta_id" TEXT NOT NULL,
    "alternativa" SMALLINT NOT NULL,
    "respondida_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resposta_pkey" PRIMARY KEY ("tentativa_id", "pergunta_id")
);

ALTER TABLE "treinamentos"."cenario_versao" ADD CONSTRAINT "cenario_versao_cenario_id_fkey"
    FOREIGN KEY ("cenario_id") REFERENCES "treinamentos"."cenario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treinamentos"."atribuicao" ADD CONSTRAINT "atribuicao_cenario_versao_id_fkey"
    FOREIGN KEY ("cenario_versao_id") REFERENCES "treinamentos"."cenario_versao"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treinamentos"."atribuicao" ADD CONSTRAINT "atribuicao_turma_id_fkey"
    FOREIGN KEY ("turma_id") REFERENCES "leadership_lab"."turma"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treinamentos"."tentativa" ADD CONSTRAINT "tentativa_atribuicao_id_fkey"
    FOREIGN KEY ("atribuicao_id") REFERENCES "treinamentos"."atribuicao"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treinamentos"."tentativa" ADD CONSTRAINT "tentativa_participante_id_fkey"
    FOREIGN KEY ("participante_id") REFERENCES "leadership_lab"."participante"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treinamentos"."resposta" ADD CONSTRAINT "resposta_tentativa_id_fkey"
    FOREIGN KEY ("tentativa_id") REFERENCES "treinamentos"."tentativa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Regras --------------------------------------------------------------------

-- Valores fechados.
ALTER TABLE "treinamentos"."cenario" ADD CONSTRAINT "cenario_status_check"
    CHECK ("status" IN ('rascunho', 'em_revisao', 'aprovado', 'arquivado'));
ALTER TABLE "treinamentos"."cenario" ADD CONSTRAINT "cenario_slug_check"
    CHECK ("slug" ~ '^[a-z][a-z0-9_-]{0,47}$');
ALTER TABLE "treinamentos"."cenario" ADD CONSTRAINT "cenario_arquivado_check"
    CHECK (("status" = 'arquivado') = ("arquivado_em" IS NOT NULL));

ALTER TABLE "treinamentos"."cenario_versao" ADD CONSTRAINT "cenario_versao_numero_check"
    CHECK ("numero" >= 1);
ALTER TABLE "treinamentos"."cenario_versao" ADD CONSTRAINT "cenario_versao_aprovacao_check"
    CHECK (("aprovado_por" IS NULL) = ("aprovado_em" IS NULL));
ALTER TABLE "treinamentos"."cenario_versao" ADD CONSTRAINT "cenario_versao_conteudo_check"
    CHECK (jsonb_typeof("conteudo") = 'object');

ALTER TABLE "treinamentos"."atribuicao" ADD CONSTRAINT "atribuicao_status_check"
    CHECK ("status" IN ('aberta', 'encerrada', 'arquivada'));

ALTER TABLE "treinamentos"."tentativa" ADD CONSTRAINT "tentativa_status_check"
    CHECK ("status" IN ('em_andamento', 'concluida', 'cancelada'));
-- Concluída <=> tem data de conclusão, decisões e resultados.
ALTER TABLE "treinamentos"."tentativa" ADD CONSTRAINT "tentativa_conclusao_check"
    CHECK (("status" = 'concluida') = (
        "concluida_em" IS NOT NULL AND "decisoes" IS NOT NULL AND "resultados" IS NOT NULL
    ));
-- Só tentativa concluída é validada; quem validou e quando andam juntos.
ALTER TABLE "treinamentos"."tentativa" ADD CONSTRAINT "tentativa_validacao_check"
    CHECK (
        ("validada_por" IS NULL) = ("validada_em" IS NULL)
        AND ("validada_em" IS NULL OR "status" = 'concluida')
    );
ALTER TABLE "treinamentos"."tentativa" ADD CONSTRAINT "tentativa_nota_check"
    CHECK ("nota_curador" IS NULL OR char_length("nota_curador") <= 2000);

ALTER TABLE "treinamentos"."resposta" ADD CONSTRAINT "resposta_alternativa_check"
    CHECK ("alternativa" BETWEEN 0 AND 3);

-- Uma tentativa em andamento por participante e atribuição.
CREATE UNIQUE INDEX "tentativa_uma_em_andamento"
    ON "treinamentos"."tentativa"("atribuicao_id", "participante_id")
    WHERE "status" = 'em_andamento';

-- Versão aprovada é imutável: não muda nem some.
CREATE FUNCTION "treinamentos"."versao_aprovada_imutavel"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD."aprovado_em" IS NOT NULL THEN
        RAISE EXCEPTION 'TREINO_VERSAO_IMUTAVEL: a versão % do cenário já foi aprovada e não muda.',
            OLD."numero"
            USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "cenario_versao_imutavel"
    BEFORE UPDATE OR DELETE ON "treinamentos"."cenario_versao"
    FOR EACH ROW EXECUTE FUNCTION "treinamentos"."versao_aprovada_imutavel"();

-- Só versão aprovada pode ser atribuída a uma turma.
CREATE FUNCTION "treinamentos"."atribuicao_exige_versao_aprovada"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "treinamentos"."cenario_versao"
         WHERE "id" = NEW."cenario_versao_id" AND "aprovado_em" IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'TREINO_VERSAO_NAO_APROVADA: só uma versão aprovada pode ser atribuída.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "atribuicao_versao_aprovada"
    BEFORE INSERT OR UPDATE OF "cenario_versao_id" ON "treinamentos"."atribuicao"
    FOR EACH ROW EXECUTE FUNCTION "treinamentos"."atribuicao_exige_versao_aprovada"();
