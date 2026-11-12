-- Leadership Lab: o agente "facilitador" (conversa sobre o resultado) passa a poder aparecer em
-- log_ia. Só amplia a lista permitida; nenhum dado é tocado.
ALTER TABLE "leadership_lab"."log_ia" DROP CONSTRAINT "ck_log_ia_agente";
ALTER TABLE "leadership_lab"."log_ia"
  ADD CONSTRAINT "ck_log_ia_agente" CHECK ("agente" IN ('agente_lab', 'guarda', 'autor', 'analista', 'agente_forms', 'facilitador'));
