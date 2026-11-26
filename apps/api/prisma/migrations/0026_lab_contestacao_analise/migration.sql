-- Leadership Lab — contestações com etapa de análise e deferimento que libera nova tentativa.
--
-- Estados: pendente (aberta) -> em_analise -> aceita (deferida) | rejeitada (indeferida). Os valores
-- gravados continuam os antigos; só `em_analise` é novo. Decidir exige justificativa (nota_decisao).
-- O deferimento marca o resultado contestado (`contestacao_deferida_em`): ele continua guardado,
-- intacto, mas a trilha de cenários deixa de contá-lo (limite do dia e cenários já feitos), e a
-- pessoa pode refazer o teste.

ALTER TABLE "leadership_lab"."contestacao"
  ADD COLUMN "analise_por" UUID,
  ADD COLUMN "analise_em" TIMESTAMPTZ(3);

ALTER TABLE "leadership_lab"."contestacao"
  DROP CONSTRAINT "ck_contestacao_status",
  DROP CONSTRAINT "ck_contestacao_decisao",
  ADD CONSTRAINT "ck_contestacao_status" CHECK ("status" IN ('pendente', 'em_analise', 'aceita', 'rejeitada')),
  ADD CONSTRAINT "ck_contestacao_decisao" CHECK (
    CASE WHEN "status" IN ('pendente', 'em_analise')
      THEN "decidido_por" IS NULL AND "decidido_em" IS NULL
      ELSE "decidido_por" IS NOT NULL AND "decidido_em" IS NOT NULL
    END
  ),
  -- A justificativa é obrigatória ao decidir (NOT VALID: não reprova decisões antigas).
  ADD CONSTRAINT "ck_contestacao_justificativa" CHECK (
    "status" IN ('pendente', 'em_analise') OR char_length(btrim(coalesce("nota_decisao", ''))) > 0
  ) NOT VALID,
  ADD CONSTRAINT "ck_contestacao_analise" CHECK (
    ("analise_por" IS NULL) = ("analise_em" IS NULL)
  );

ALTER TABLE "leadership_lab"."resultado"
  ADD COLUMN "contestacao_deferida_em" TIMESTAMPTZ(3);
