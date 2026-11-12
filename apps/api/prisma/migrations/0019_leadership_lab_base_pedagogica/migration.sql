-- Leadership Lab: a base pedagógica de cada teste. Só acrescenta colunas anuláveis (ou com padrão);
-- nenhum dado existente muda, e os testes antigos ficam com a base em branco (= experimentais).
--   sessao.rubrica_versao   a versão da rubrica com que o teste foi conduzido
--   sessao.dificuldade      a dificuldade-base sugerida pelo histórico (1 a 3)
--   turno.base_pedagogica   competências, dificuldade e fontes de cada situação
--   turno.fundamentacao     'validada' ou 'experimental' (decidida pelo backend)
--   resultado.experimental  verdadeiro se alguma situação do teste era experimental
ALTER TABLE "leadership_lab"."sessao"
  ADD COLUMN "rubrica_versao" TEXT,
  ADD COLUMN "dificuldade" SMALLINT,
  ADD CONSTRAINT "ck_sessao_dificuldade" CHECK ("dificuldade" IS NULL OR "dificuldade" BETWEEN 1 AND 3);

ALTER TABLE "leadership_lab"."turno"
  ADD COLUMN "base_pedagogica" JSONB,
  ADD COLUMN "fundamentacao" TEXT,
  ADD CONSTRAINT "ck_turno_fundamentacao" CHECK ("fundamentacao" IS NULL OR "fundamentacao" IN ('validada', 'experimental'));

ALTER TABLE "leadership_lab"."resultado"
  ADD COLUMN "experimental" BOOLEAN NOT NULL DEFAULT false;
