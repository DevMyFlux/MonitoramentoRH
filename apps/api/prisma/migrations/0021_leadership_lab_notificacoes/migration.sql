-- Leadership Lab: leitura das notificações do curador. As notificações em si NÃO são gravadas: são
-- derivadas, a cada consulta, do que espera decisão (resultados, alertas, contestações e
-- contribuições pendentes). Aqui fica só quem já leu o quê, por usuário, com a chave estável do item
-- ("alerta:<id>"); a chave única impede duplicar a marcação.
CREATE TABLE "leadership_lab"."notificacao_leitura" (
  "user_id" UUID NOT NULL,
  "chave"   TEXT NOT NULL,
  "lida_em" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "notificacao_leitura_pkey" PRIMARY KEY ("user_id", "chave"),
  CONSTRAINT "notificacao_leitura_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ck_notificacao_leitura_chave" CHECK ("chave" ~ '^(resultado|alerta|contestacao|contribuicao):[0-9a-f-]{36}$')
);
