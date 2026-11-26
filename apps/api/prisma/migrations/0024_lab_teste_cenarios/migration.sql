-- Leadership Lab: o teste por cenários (a trilha de Treinamentos dentro do Lab).
--
-- Aditiva: nenhuma tabela nem coluna é removida e nenhum dado muda. O modo "dinamico" (IA) continua
-- existindo (LAB_TESTE_MODO=legado). O que entra:
--   1. sessao.modo aceita "cenarios"; sessao.origem ("participante" ou "interno") e sessao.publico.
--   2. tentativa_cenario: um cenário da trilha de uma sessão (versão aprovada, ordem, desfecho).
--   3. resposta_cenario: a alternativa escolhida em cada pergunta, com o tempo gasto.
-- O resultado do teste continua em leadership_lab.resultado (um por sessão), calculado no servidor.

-- 1. sessao ---------------------------------------------------------------------------------
ALTER TABLE "leadership_lab"."sessao" DROP CONSTRAINT "ck_sessao_modo";
ALTER TABLE "leadership_lab"."sessao"
    ADD CONSTRAINT "ck_sessao_modo" CHECK ("modo" IN ('dinamico', 'cenarios'));

-- Quem fez o teste: o COMUM é "participante"; DEV, ADMIN e RH são "interno". Resultado interno nunca
-- entra em métrica nem em comparação de participantes (o filtro é do servidor, na consulta).
ALTER TABLE "leadership_lab"."sessao" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'participante';
ALTER TABLE "leadership_lab"."sessao"
    ADD CONSTRAINT "ck_sessao_origem" CHECK ("origem" IN ('participante', 'interno'));
-- O público dos cenários da trilha (só no modo "cenarios").
ALTER TABLE "leadership_lab"."sessao" ADD COLUMN "publico" TEXT;
ALTER TABLE "leadership_lab"."sessao"
    ADD CONSTRAINT "ck_sessao_publico" CHECK (
        "publico" IS NULL OR "publico" IN
            ('supervisor-manutencao-adm', 'coordenador-administrativo', 'rh', 'administrativo-geral')
    ),
    ADD CONSTRAINT "ck_sessao_publico_so_em_cenarios" CHECK ("publico" IS NULL OR "modo" = 'cenarios');
CREATE INDEX "sessao_origem_idx" ON "leadership_lab"."sessao"("origem");

-- 2. tentativa_cenario ----------------------------------------------------------------------
CREATE TABLE "leadership_lab"."tentativa_cenario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessao_id" UUID NOT NULL,
    "ordem" SMALLINT NOT NULL,
    "cenario_versao_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "iniciada_em" TIMESTAMPTZ(3),
    "concluida_em" TIMESTAMPTZ(3),
    -- As decisões cumpridas (id da decisão -> true/false) e o desfecho (acontecimentos e as 3 saídas),
    -- calculados no servidor ao concluir. Nulos enquanto o cenário não termina.
    "decisoes" JSONB,
    "desfecho" JSONB,

    CONSTRAINT "tentativa_cenario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tentativa_cenario_sessao_id_ordem_key"
    ON "leadership_lab"."tentativa_cenario"("sessao_id", "ordem");
-- O mesmo cenário não aparece duas vezes na mesma trilha.
CREATE UNIQUE INDEX "tentativa_cenario_sessao_id_cenario_versao_id_key"
    ON "leadership_lab"."tentativa_cenario"("sessao_id", "cenario_versao_id");
CREATE INDEX "tentativa_cenario_cenario_versao_id_idx"
    ON "leadership_lab"."tentativa_cenario"("cenario_versao_id");
-- Um só cenário em andamento por sessão (o atual da trilha).
CREATE UNIQUE INDEX "ux_tentativa_cenario_em_andamento_por_sessao"
    ON "leadership_lab"."tentativa_cenario"("sessao_id") WHERE "status" = 'em_andamento';

ALTER TABLE "leadership_lab"."tentativa_cenario"
    ADD CONSTRAINT "tentativa_cenario_sessao_id_fkey" FOREIGN KEY ("sessao_id")
        REFERENCES "leadership_lab"."sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "tentativa_cenario_cenario_versao_id_fkey" FOREIGN KEY ("cenario_versao_id")
        REFERENCES "treinamentos"."cenario_versao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ck_tentativa_cenario_ordem" CHECK ("ordem" BETWEEN 1 AND 10),
    ADD CONSTRAINT "ck_tentativa_cenario_status" CHECK ("status" IN ('pendente', 'em_andamento', 'concluida')),
    -- Concluída = com data, decisões e desfecho; as outras, sem nenhum dos três.
    ADD CONSTRAINT "ck_tentativa_cenario_conclusao" CHECK (
        ("status" = 'concluida') = ("concluida_em" IS NOT NULL AND "decisoes" IS NOT NULL AND "desfecho" IS NOT NULL)
        AND ("status" = 'concluida' OR ("concluida_em" IS NULL AND "decisoes" IS NULL AND "desfecho" IS NULL))
    ),
    -- Pendente = ainda sem início; em andamento e concluída já começaram.
    ADD CONSTRAINT "ck_tentativa_cenario_inicio" CHECK (("status" = 'pendente') = ("iniciada_em" IS NULL)),
    ADD CONSTRAINT "ck_tentativa_cenario_datas" CHECK ("concluida_em" IS NULL OR "concluida_em" >= "iniciada_em");

-- 3. resposta_cenario -----------------------------------------------------------------------
CREATE TABLE "leadership_lab"."resposta_cenario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tentativa_cenario_id" UUID NOT NULL,
    "pergunta_id" TEXT NOT NULL,
    "alternativa" SMALLINT NOT NULL,
    "respondida_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Tempo desde que a pergunta foi apresentada (a abertura da trilha ou a resposta anterior), em ms.
    "tempo_ms" INTEGER,

    CONSTRAINT "resposta_cenario_pkey" PRIMARY KEY ("id")
);

-- Uma resposta por pergunta: a mesma de novo é idempotente (o servidor trata), outra é recusada.
CREATE UNIQUE INDEX "resposta_cenario_tentativa_cenario_id_pergunta_id_key"
    ON "leadership_lab"."resposta_cenario"("tentativa_cenario_id", "pergunta_id");

ALTER TABLE "leadership_lab"."resposta_cenario"
    ADD CONSTRAINT "resposta_cenario_tentativa_cenario_id_fkey" FOREIGN KEY ("tentativa_cenario_id")
        REFERENCES "leadership_lab"."tentativa_cenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ck_resposta_cenario_alternativa" CHECK ("alternativa" BETWEEN 0 AND 3),
    ADD CONSTRAINT "ck_resposta_cenario_tempo" CHECK ("tempo_ms" IS NULL OR "tempo_ms" >= 0);

-- Só se responde num cenário em andamento: o banco recusa resposta em cenário pendente ou concluído.
CREATE FUNCTION "leadership_lab"."resposta_cenario_exige_em_andamento"() RETURNS trigger AS $$
BEGIN
    IF (SELECT "status" FROM "leadership_lab"."tentativa_cenario" WHERE "id" = NEW."tentativa_cenario_id")
        IS DISTINCT FROM 'em_andamento' THEN
        RAISE EXCEPTION 'resposta_cenario: o cenario nao esta em andamento'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_resposta_cenario_em_andamento"
    BEFORE INSERT ON "leadership_lab"."resposta_cenario"
    FOR EACH ROW EXECUTE FUNCTION "leadership_lab"."resposta_cenario_exige_em_andamento"();

-- A resposta dada não muda nem some (é o registro do que a pessoa decidiu).
CREATE FUNCTION "leadership_lab"."resposta_cenario_imutavel"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'resposta_cenario: a resposta dada nao pode ser alterada nem apagada'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_resposta_cenario_imutavel"
    BEFORE UPDATE OR DELETE ON "leadership_lab"."resposta_cenario"
    FOR EACH ROW EXECUTE FUNCTION "leadership_lab"."resposta_cenario_imutavel"();
