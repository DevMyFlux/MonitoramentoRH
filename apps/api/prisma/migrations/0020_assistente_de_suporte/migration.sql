-- Assistente de suporte do MY FLUX: o agente "suporte" passa a poder aparecer em log_ia (consumo e
-- custo da IA). Só amplia a lista permitida; nenhum dado é tocado. Nada da conversa é guardado.
ALTER TABLE "leadership_lab"."log_ia" DROP CONSTRAINT "ck_log_ia_agente";
ALTER TABLE "leadership_lab"."log_ia"
  ADD CONSTRAINT "ck_log_ia_agente" CHECK ("agente" IN ('agente_lab', 'guarda', 'autor', 'analista', 'agente_forms', 'facilitador', 'suporte'));
