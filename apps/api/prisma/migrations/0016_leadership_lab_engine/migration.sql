-- Leadership Lab — garantias que o motor do teste precisa do banco.
--
-- 1. Uma única sessão EM ANDAMENTO por participante. Clicar duas vezes em "Iniciar teste",
--    ou abrir o módulo em duas abas, não cria duas sessões: a segunda falha por esta
--    restrição e o motor devolve a que já existe. (Índice parcial: o Prisma não o expressa,
--    mas também não o enxerga como divergência.)
--
-- 2. `processando_ate` no turno: reserva (lease) enquanto a IA é consultada. Duas requisições
--    idênticas ao mesmo tempo não disparam duas chamadas: a que reservou segue, a outra
--    recebe "em processamento". A reserva expira sozinha se o processo morrer no meio.
--    Nulo = ninguém processando.

CREATE UNIQUE INDEX "ux_sessao_em_andamento_por_participante"
  ON "leadership_lab"."sessao" ("participante_id")
  WHERE "status" = 'em_andamento';

ALTER TABLE "leadership_lab"."turno" ADD COLUMN "processando_ate" TIMESTAMPTZ(3);
