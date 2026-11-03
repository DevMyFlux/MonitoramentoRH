-- Leadership Lab — schemas, tabelas, regras de integridade, view e dados iniciais.
--
-- Estrutura:
--   1. Schemas.
--   2. Tabelas, índices e chaves estrangeiras, geradas pelo Prisma (schema.prisma).
--   3. Regras que o Prisma não expressa: CHECK, índices parciais e a view do painel.
--   4. Dados iniciais (referência): as 8 skills do piloto e os 3 moldes, estes
--      INATIVOS e sem tempo limite até a decisão de negócio (tempo por situação).
--
-- Para desfazer: down.sql nesta pasta. O Prisma Migrate não executa migrações de
-- descida; o down.sql é aplicado à mão e coberto por teste de integração.
--
-- Cuidado com NULL nos CHECK: uma expressão NULL é aceita pelo Postgres. Por isso
-- as regras abaixo usam IS NOT NULL / IS DISTINCT FROM / CASE de forma explícita.

-- 1. Schemas -------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS "leadership_lab";

-- Sessões do Google ADK. As tabelas pertencem ao serviço de IA, que as cria sozinho.
CREATE SCHEMA IF NOT EXISTS "leadership_lab_ia";
COMMENT ON SCHEMA "leadership_lab_ia" IS
  'Sessões do Google ADK. As tabelas são criadas e mantidas pelo serviço de IA, não pelo Prisma.';

-- 2. Tabelas (geradas pelo Prisma) ----------------------------------------------

-- CreateTable
CREATE TABLE "leadership_lab"."skill" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."molde" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nivel" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "temas" JSONB NOT NULL DEFAULT '[]',
    "numero_situacoes" INTEGER NOT NULL DEFAULT 5,
    "tempo_limite_s" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "atualizado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "molde_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."molde_cargo" (
    "job_function_id" UUID NOT NULL,
    "molde_id" UUID NOT NULL,
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "molde_cargo_pkey" PRIMARY KEY ("job_function_id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."participante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."permissao_usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "permissao" TEXT NOT NULL,
    "concedida_por" UUID,
    "concedida_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissao_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."turma" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "curador_id" UUID NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."turma_participante" (
    "turma_id" UUID NOT NULL,
    "participante_id" UUID NOT NULL,
    "adicionado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turma_participante_pkey" PRIMARY KEY ("turma_id","participante_id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."termo_aceite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participante_id" UUID NOT NULL,
    "versao_termo" TEXT NOT NULL,
    "aceito_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "termo_aceite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."sessao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participante_id" UUID NOT NULL,
    "molde_id" UUID NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'dinamico',
    "ia_sessao_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'em_andamento',
    "iniciada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em" TIMESTAMPTZ(3),

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."turno" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessao_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "marco" BOOLEAN NOT NULL DEFAULT false,
    "texto" TEXT NOT NULL,
    "opcoes" JSONB NOT NULL,
    "estilo_adequado" TEXT NOT NULL,
    "apresentada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_em" TIMESTAMPTZ(3),
    "escolha" TEXT,
    "tempo_resposta_ms" INTEGER,
    "tempo_esgotado" BOOLEAN NOT NULL DEFAULT false,
    "aderencia" INTEGER,
    "estilo" TEXT,
    "alerta" TEXT,
    "justificativa" TEXT,
    "consequencia" TEXT,
    "texto_livre" TEXT,
    "decisao_guarda" TEXT,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."turno_skill" (
    "turno_id" UUID NOT NULL,
    "skill_id" TEXT NOT NULL,

    CONSTRAINT "turno_skill_pkey" PRIMARY KEY ("turno_id","skill_id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."resultado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessao_id" UUID NOT NULL,
    "aderencia_geral" DOUBLE PRECISION NOT NULL,
    "agilidade" DOUBLE PRECISION NOT NULL,
    "estilo_predominante" TEXT,
    "flexibilidade_pct" DOUBLE PRECISION,
    "flexibilidade" TEXT,
    "niveis_por_skill" JSONB NOT NULL DEFAULT '{}',
    "resumo" TEXT NOT NULL,
    "ponto_forte" TEXT,
    "ponto_desenvolvimento" TEXT,
    "sugestoes" JSONB NOT NULL DEFAULT '[]',
    "resposta_ia" JSONB NOT NULL,
    "status_validacao" TEXT NOT NULL DEFAULT 'aguardando_validacao',
    "validado_por" UUID,
    "validado_em" TIMESTAMPTZ(3),
    "justificativa_validacao" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."perfil_skill" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participante_id" UUID NOT NULL,
    "skill_id" TEXT NOT NULL,
    "sessao_id" UUID NOT NULL,
    "nivel" INTEGER NOT NULL,
    "n_evidencias" INTEGER NOT NULL,
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "nivel_validado" INTEGER,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfil_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."alerta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessao_id" UUID NOT NULL,
    "turno_id" UUID,
    "cor" TEXT NOT NULL,
    "skill_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "tratado_por" UUID,
    "tratado_em" TIMESTAMPTZ(3),
    "nota" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."contribuicao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessao_id" UUID NOT NULL,
    "turno_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "decidido_por" UUID,
    "decidido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."contestacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resultado_id" UUID NOT NULL,
    "ponto" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "decidido_por" UUID,
    "decidido_em" TIMESTAMPTZ(3),
    "nota_decisao" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contestacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_lab"."log_ia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agente" TEXT NOT NULL,
    "versao_instrucao" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokens_entrada" INTEGER,
    "tokens_saida" INTEGER,
    "latencia_ms" INTEGER NOT NULL,
    "sucesso" BOOLEAN NOT NULL,
    "codigo_erro" TEXT,
    "sessao_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "molde_nivel_key" ON "leadership_lab"."molde"("nivel");

-- CreateIndex
CREATE INDEX "molde_cargo_molde_id_idx" ON "leadership_lab"."molde_cargo"("molde_id");

-- CreateIndex
CREATE UNIQUE INDEX "participante_user_id_key" ON "leadership_lab"."participante"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "participante_employee_id_key" ON "leadership_lab"."participante"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissao_usuario_user_id_permissao_key" ON "leadership_lab"."permissao_usuario"("user_id", "permissao");

-- CreateIndex
CREATE INDEX "turma_curador_id_idx" ON "leadership_lab"."turma"("curador_id");

-- CreateIndex
CREATE INDEX "turma_participante_participante_id_idx" ON "leadership_lab"."turma_participante"("participante_id");

-- CreateIndex
CREATE UNIQUE INDEX "termo_aceite_participante_id_versao_termo_key" ON "leadership_lab"."termo_aceite"("participante_id", "versao_termo");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_ia_sessao_id_key" ON "leadership_lab"."sessao"("ia_sessao_id");

-- CreateIndex
CREATE INDEX "sessao_participante_id_iniciada_em_idx" ON "leadership_lab"."sessao"("participante_id", "iniciada_em" DESC);

-- CreateIndex
CREATE INDEX "sessao_status_idx" ON "leadership_lab"."sessao"("status");

-- CreateIndex
CREATE UNIQUE INDEX "turno_sessao_id_numero_key" ON "leadership_lab"."turno"("sessao_id", "numero");

-- CreateIndex
CREATE INDEX "turno_skill_skill_id_idx" ON "leadership_lab"."turno_skill"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_sessao_id_key" ON "leadership_lab"."resultado"("sessao_id");

-- CreateIndex
CREATE INDEX "perfil_skill_participante_id_skill_id_criado_em_idx" ON "leadership_lab"."perfil_skill"("participante_id", "skill_id", "criado_em" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "perfil_skill_sessao_id_skill_id_key" ON "leadership_lab"."perfil_skill"("sessao_id", "skill_id");

-- CreateIndex
CREATE INDEX "alerta_status_cor_idx" ON "leadership_lab"."alerta"("status", "cor");

-- CreateIndex
CREATE INDEX "alerta_sessao_id_idx" ON "leadership_lab"."alerta"("sessao_id");

-- CreateIndex
CREATE UNIQUE INDEX "contribuicao_turno_id_key" ON "leadership_lab"."contribuicao"("turno_id");

-- CreateIndex
CREATE INDEX "contribuicao_status_idx" ON "leadership_lab"."contribuicao"("status");

-- CreateIndex
CREATE INDEX "contribuicao_sessao_id_idx" ON "leadership_lab"."contribuicao"("sessao_id");

-- CreateIndex
CREATE INDEX "contestacao_status_idx" ON "leadership_lab"."contestacao"("status");

-- CreateIndex
CREATE INDEX "contestacao_resultado_id_idx" ON "leadership_lab"."contestacao"("resultado_id");

-- CreateIndex
CREATE INDEX "log_ia_criado_em_idx" ON "leadership_lab"."log_ia"("criado_em");

-- CreateIndex
CREATE INDEX "log_ia_sessao_id_idx" ON "leadership_lab"."log_ia"("sessao_id");

-- AddForeignKey
ALTER TABLE "leadership_lab"."molde_cargo" ADD CONSTRAINT "molde_cargo_job_function_id_fkey" FOREIGN KEY ("job_function_id") REFERENCES "JobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."molde_cargo" ADD CONSTRAINT "molde_cargo_molde_id_fkey" FOREIGN KEY ("molde_id") REFERENCES "leadership_lab"."molde"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."participante" ADD CONSTRAINT "participante_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."participante" ADD CONSTRAINT "participante_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."permissao_usuario" ADD CONSTRAINT "permissao_usuario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."turma" ADD CONSTRAINT "turma_curador_id_fkey" FOREIGN KEY ("curador_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."turma_participante" ADD CONSTRAINT "turma_participante_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "leadership_lab"."turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."turma_participante" ADD CONSTRAINT "turma_participante_participante_id_fkey" FOREIGN KEY ("participante_id") REFERENCES "leadership_lab"."participante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."termo_aceite" ADD CONSTRAINT "termo_aceite_participante_id_fkey" FOREIGN KEY ("participante_id") REFERENCES "leadership_lab"."participante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."sessao" ADD CONSTRAINT "sessao_participante_id_fkey" FOREIGN KEY ("participante_id") REFERENCES "leadership_lab"."participante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."sessao" ADD CONSTRAINT "sessao_molde_id_fkey" FOREIGN KEY ("molde_id") REFERENCES "leadership_lab"."molde"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."turno" ADD CONSTRAINT "turno_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "leadership_lab"."sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."turno_skill" ADD CONSTRAINT "turno_skill_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "leadership_lab"."turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."turno_skill" ADD CONSTRAINT "turno_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "leadership_lab"."skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."resultado" ADD CONSTRAINT "resultado_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "leadership_lab"."sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."perfil_skill" ADD CONSTRAINT "perfil_skill_participante_id_fkey" FOREIGN KEY ("participante_id") REFERENCES "leadership_lab"."participante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."perfil_skill" ADD CONSTRAINT "perfil_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "leadership_lab"."skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."perfil_skill" ADD CONSTRAINT "perfil_skill_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "leadership_lab"."sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."alerta" ADD CONSTRAINT "alerta_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "leadership_lab"."sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."alerta" ADD CONSTRAINT "alerta_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "leadership_lab"."turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."alerta" ADD CONSTRAINT "alerta_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "leadership_lab"."skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."contribuicao" ADD CONSTRAINT "contribuicao_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "leadership_lab"."sessao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."contribuicao" ADD CONSTRAINT "contribuicao_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "leadership_lab"."turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."contestacao" ADD CONSTRAINT "contestacao_resultado_id_fkey" FOREIGN KEY ("resultado_id") REFERENCES "leadership_lab"."resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_lab"."log_ia" ADD CONSTRAINT "log_ia_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "leadership_lab"."sessao"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 3. Regras de integridade que o Prisma não expressa ---------------------------

-- skill
ALTER TABLE "leadership_lab"."skill"
  ADD CONSTRAINT "ck_skill_tipo" CHECK ("tipo" IN ('hard', 'soft'));

-- molde: nasce inativo; só ativa com tempo limite definido.
ALTER TABLE "leadership_lab"."molde"
  ADD CONSTRAINT "ck_molde_nivel" CHECK ("nivel" IN ('encarregado', 'supervisor', 'coordenador')),
  ADD CONSTRAINT "ck_molde_numero_situacoes" CHECK ("numero_situacoes" >= 3), -- a situação 3 é o marco
  ADD CONSTRAINT "ck_molde_tempo_positivo" CHECK ("tempo_limite_s" IS NULL OR "tempo_limite_s" > 0),
  ADD CONSTRAINT "ck_molde_ativo_exige_tempo" CHECK (NOT "ativo" OR "tempo_limite_s" IS NOT NULL),
  ADD CONSTRAINT "ck_molde_temas_lista" CHECK (jsonb_typeof("temas") = 'array');

-- permissao_usuario
ALTER TABLE "leadership_lab"."permissao_usuario"
  ADD CONSTRAINT "ck_permissao_usuario_permissao" CHECK ("permissao" IN ('lab_gestao', 'lab_especialista'));

-- termo_aceite
ALTER TABLE "leadership_lab"."termo_aceite"
  ADD CONSTRAINT "ck_termo_aceite_versao" CHECK (char_length(btrim("versao_termo")) > 0);

-- sessao: só o modo dinâmico existe no piloto; "validado" entra na versão 1 junto
-- com teste_versao_id.
ALTER TABLE "leadership_lab"."sessao"
  ADD CONSTRAINT "ck_sessao_modo" CHECK ("modo" IN ('dinamico')),
  ADD CONSTRAINT "ck_sessao_status" CHECK ("status" IN ('em_andamento', 'concluida', 'cancelada')),
  ADD CONSTRAINT "ck_sessao_concluida_em" CHECK (("status" = 'concluida') = ("concluida_em" IS NOT NULL)),
  ADD CONSTRAINT "ck_sessao_datas" CHECK ("concluida_em" IS NULL OR "concluida_em" >= "iniciada_em");

-- turno
ALTER TABLE "leadership_lab"."turno"
  ADD CONSTRAINT "ck_turno_numero" CHECK ("numero" BETWEEN 1 AND 10),
  -- A terceira situação é o marco, e só ela.
  ADD CONSTRAINT "ck_turno_marco" CHECK ("marco" = ("numero" = 3)),
  -- Sempre três respostas.
  ADD CONSTRAINT "ck_turno_opcoes" CHECK (
    CASE WHEN jsonb_typeof("opcoes") = 'array' THEN jsonb_array_length("opcoes") = 3 ELSE false END
  ),
  ADD CONSTRAINT "ck_turno_estilo_adequado" CHECK ("estilo_adequado" IN ('direcao', 'orientacao', 'apoio', 'delegacao')),
  ADD CONSTRAINT "ck_turno_escolha" CHECK ("escolha" IS NULL OR "escolha" IN ('A', 'B', 'C')),
  ADD CONSTRAINT "ck_turno_estilo" CHECK ("estilo" IS NULL OR "estilo" IN ('direcao', 'orientacao', 'apoio', 'delegacao')),
  -- Escala fixa de aderência: 100, 70, 40, 10 ou 0 (0 = tempo esgotado).
  ADD CONSTRAINT "ck_turno_aderencia_escala" CHECK ("aderencia" IS NULL OR "aderencia" IN (0, 10, 40, 70, 100)),
  ADD CONSTRAINT "ck_turno_tempo_resposta" CHECK ("tempo_resposta_ms" IS NULL OR "tempo_resposta_ms" >= 0),
  ADD CONSTRAINT "ck_turno_datas" CHECK ("respondida_em" IS NULL OR "respondida_em" >= "apresentada_em"),
  -- Estados possíveis: pendente (sem escolha, sem resposta), respondido (com escolha)
  -- ou tempo esgotado (sem escolha, marcado como tal).
  ADD CONSTRAINT "ck_turno_estado" CHECK (("escolha" IS NULL) = ("respondida_em" IS NULL OR "tempo_esgotado")),
  -- Tempo esgotado conta como omissão: sem escolha e aderência 0.
  ADD CONSTRAINT "ck_turno_omissao" CHECK (NOT "tempo_esgotado" OR ("escolha" IS NULL AND "aderencia" IS NOT NULL AND "aderencia" = 0)),
  ADD CONSTRAINT "ck_turno_zero_so_por_omissao" CHECK ("aderencia" IS DISTINCT FROM 0 OR "tempo_esgotado"),
  -- Alerta vermelho existe se, e somente se, a aderência é 10.
  ADD CONSTRAINT "ck_turno_alerta" CHECK ("alerta" IS NULL OR "alerta" = 'vermelho'),
  ADD CONSTRAINT "ck_turno_alerta_so_com_10" CHECK ("alerta" IS NULL OR ("aderencia" IS NOT NULL AND "aderencia" = 10)),
  ADD CONSTRAINT "ck_turno_10_gera_alerta" CHECK ("aderencia" IS DISTINCT FROM 10 OR "alerta" IS NOT NULL),
  ADD CONSTRAINT "ck_turno_decisao_guarda" CHECK ("decisao_guarda" IS NULL OR "decisao_guarda" IN ('seguir', 'mascarar', 'bloquear')),
  -- O campo livre só é gravado depois de passar pela Guarda; texto bloqueado nunca é gravado.
  ADD CONSTRAINT "ck_turno_texto_livre_guarda" CHECK (
    "texto_livre" IS NULL OR COALESCE("decisao_guarda" IN ('seguir', 'mascarar'), false)
  );

-- resultado
ALTER TABLE "leadership_lab"."resultado"
  ADD CONSTRAINT "ck_resultado_aderencia_geral" CHECK ("aderencia_geral" BETWEEN 0 AND 100),
  ADD CONSTRAINT "ck_resultado_agilidade" CHECK ("agilidade" BETWEEN 0 AND 100),
  ADD CONSTRAINT "ck_resultado_flexibilidade_pct" CHECK ("flexibilidade_pct" IS NULL OR "flexibilidade_pct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "ck_resultado_estilo_predominante" CHECK ("estilo_predominante" IS NULL OR "estilo_predominante" IN ('direcao', 'orientacao', 'apoio', 'delegacao')),
  ADD CONSTRAINT "ck_resultado_flexibilidade" CHECK ("flexibilidade" IS NULL OR "flexibilidade" IN ('alta', 'media', 'baixa')),
  ADD CONSTRAINT "ck_resultado_niveis_objeto" CHECK (jsonb_typeof("niveis_por_skill") = 'object'),
  ADD CONSTRAINT "ck_resultado_sugestoes_lista" CHECK (jsonb_typeof("sugestoes") = 'array'),
  ADD CONSTRAINT "ck_resultado_status" CHECK ("status_validacao" IN ('aguardando_validacao', 'validado', 'ajustado')),
  -- Nenhum resultado vira oficial sem quem validou e quando.
  ADD CONSTRAINT "ck_resultado_validacao" CHECK (
    CASE WHEN "status_validacao" = 'aguardando_validacao'
      THEN "validado_por" IS NULL AND "validado_em" IS NULL
      ELSE "validado_por" IS NOT NULL AND "validado_em" IS NOT NULL
    END
  ),
  -- Ajustar um nível exige justificativa.
  ADD CONSTRAINT "ck_resultado_ajuste_justificado" CHECK (
    "status_validacao" <> 'ajustado'
    OR ("justificativa_validacao" IS NOT NULL AND char_length(btrim("justificativa_validacao")) > 0)
  );

-- perfil_skill
ALTER TABLE "leadership_lab"."perfil_skill"
  ADD CONSTRAINT "ck_perfil_skill_nivel" CHECK ("nivel" BETWEEN 1 AND 5),
  ADD CONSTRAINT "ck_perfil_skill_evidencias" CHECK ("n_evidencias" >= 1),
  ADD CONSTRAINT "ck_perfil_skill_nivel_validado" CHECK ("nivel_validado" IS NULL OR "nivel_validado" BETWEEN 1 AND 5),
  ADD CONSTRAINT "ck_perfil_skill_validado" CHECK ("validado" = ("nivel_validado" IS NOT NULL));

-- alerta: vermelho nasce de um turno; amarelo, de uma skill. Encerrar exige quem e a
-- nota da conversa de desenvolvimento.
ALTER TABLE "leadership_lab"."alerta"
  ADD CONSTRAINT "ck_alerta_cor" CHECK ("cor" IN ('vermelho', 'amarelo')),
  ADD CONSTRAINT "ck_alerta_status" CHECK ("status" IN ('aberto', 'encerrado')),
  ADD CONSTRAINT "ck_alerta_origem" CHECK (
    ("cor" = 'vermelho' AND "turno_id" IS NOT NULL) OR ("cor" = 'amarelo' AND "skill_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "ck_alerta_encerramento" CHECK (
    CASE WHEN "status" = 'aberto'
      THEN "tratado_por" IS NULL AND "tratado_em" IS NULL
      ELSE "tratado_por" IS NOT NULL AND "tratado_em" IS NOT NULL
        AND "nota" IS NOT NULL AND char_length(btrim("nota")) > 0
    END
  );

-- Um único alerta vermelho por turno e um único amarelo por sessão e skill
-- (reprocessar o mesmo resultado não duplica alertas).
CREATE UNIQUE INDEX "ux_alerta_vermelho_por_turno"
  ON "leadership_lab"."alerta" ("turno_id") WHERE "cor" = 'vermelho';
CREATE UNIQUE INDEX "ux_alerta_amarelo_por_sessao_skill"
  ON "leadership_lab"."alerta" ("sessao_id", "skill_id") WHERE "cor" = 'amarelo';

-- contribuicao
ALTER TABLE "leadership_lab"."contribuicao"
  ADD CONSTRAINT "ck_contribuicao_status" CHECK ("status" IN ('pendente', 'aprovada', 'rejeitada')),
  ADD CONSTRAINT "ck_contribuicao_texto" CHECK (char_length(btrim("texto")) > 0),
  ADD CONSTRAINT "ck_contribuicao_decisao" CHECK (
    CASE WHEN "status" = 'pendente'
      THEN "decidido_por" IS NULL AND "decidido_em" IS NULL
      ELSE "decidido_por" IS NOT NULL AND "decidido_em" IS NOT NULL
    END
  );

-- contestacao
ALTER TABLE "leadership_lab"."contestacao"
  ADD CONSTRAINT "ck_contestacao_status" CHECK ("status" IN ('pendente', 'aceita', 'rejeitada')),
  ADD CONSTRAINT "ck_contestacao_textos" CHECK (char_length(btrim("ponto")) > 0 AND char_length(btrim("motivo")) > 0),
  ADD CONSTRAINT "ck_contestacao_decisao" CHECK (
    CASE WHEN "status" = 'pendente'
      THEN "decidido_por" IS NULL AND "decidido_em" IS NULL
      ELSE "decidido_por" IS NOT NULL AND "decidido_em" IS NOT NULL
    END
  );

-- log_ia: só metadados (agente, versão, modelo, tokens, latência), nunca conteúdo.
ALTER TABLE "leadership_lab"."log_ia"
  ADD CONSTRAINT "ck_log_ia_agente" CHECK ("agente" IN ('agente_lab', 'guarda', 'autor', 'analista', 'agente_forms')),
  ADD CONSTRAINT "ck_log_ia_latencia" CHECK ("latencia_ms" >= 0),
  ADD CONSTRAINT "ck_log_ia_tokens" CHECK (
    ("tokens_entrada" IS NULL OR "tokens_entrada" >= 0) AND ("tokens_saida" IS NULL OR "tokens_saida" >= 0)
  ),
  ADD CONSTRAINT "ck_log_ia_erro" CHECK ("sucesso" OR "codigo_erro" IS NOT NULL);

-- View que alimenta o painel do participante (cartões de indicadores).
CREATE VIEW "leadership_lab"."vw_painel_participante" AS
SELECT
  p."id"                                                                 AS "participante_id",
  COUNT(r."id")::int                                                     AS "testes_feitos",
  (COUNT(r."id") FILTER (WHERE r."status_validacao" <> 'aguardando_validacao'))::int AS "testes_validados",
  AVG(r."aderencia_geral")::float8                                       AS "aderencia_media",
  AVG(r."agilidade")::float8                                             AS "agilidade_media",
  MAX(s."concluida_em")                                                  AS "ultimo_teste_em",
  (
    SELECT COUNT(*)::int
    FROM "leadership_lab"."alerta" a
    JOIN "leadership_lab"."sessao" sa ON sa."id" = a."sessao_id"
    WHERE sa."participante_id" = p."id" AND a."status" = 'aberto'
  )                                                                      AS "alertas_abertos"
FROM "leadership_lab"."participante" p
LEFT JOIN "leadership_lab"."sessao" s
  ON s."participante_id" = p."id" AND s."status" = 'concluida'
LEFT JOIN "leadership_lab"."resultado" r ON r."sessao_id" = s."id"
GROUP BY p."id";

-- 4. Dados iniciais ------------------------------------------------------------

-- As 8 skills do piloto.
INSERT INTO "leadership_lab"."skill" ("id", "nome", "tipo") VALUES
  ('aplicacao-nr-pop',    'Aplicação de NR e POP',                'hard'),
  ('gestao-os',           'Gestão de OS e prioridades',           'hard'),
  ('contingencia',        'Plano de contingência',                'hard'),
  ('materiais-custos',    'Gestão de materiais e custos',         'hard'),
  ('comunicacao-cliente', 'Comunicação com o cliente',            'soft'),
  ('gestao-equipe',       'Gestão de equipe e conflitos',         'soft'),
  ('decisao-pressao',     'Decisão sob pressão',                  'soft'),
  ('delegacao',           'Delegação e desenvolvimento do time',  'soft')
ON CONFLICT ("id") DO NOTHING;

-- Os 3 moldes, um por nível de liderança. Entram INATIVOS e sem tempo limite: o tempo
-- por situação é decisão de negócio em aberto. Ativar exige informar o tempo.
INSERT INTO "leadership_lab"."molde" ("nivel", "nome", "temas") VALUES
  ('encarregado', 'Encarregado',
    '["Execução no turno", "EPI", "Ferramentas", "Distribuição de tarefas"]'::jsonb),
  ('supervisor', 'Supervisor',
    '["Prioridade de OS", "Falta de material", "Comunicação com o solicitante", "Conflito na equipe"]'::jsonb),
  ('coordenador', 'Coordenador',
    '["Contrato e SLA", "Cliente insatisfeito", "Indicadores", "Desempenho de supervisores", "Custos"]'::jsonb)
ON CONFLICT ("nivel") DO NOTHING;
