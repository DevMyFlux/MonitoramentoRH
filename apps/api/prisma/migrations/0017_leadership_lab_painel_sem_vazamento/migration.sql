-- Leadership Lab — a view do painel deixa de contar alertas de testes em andamento.
--
-- O alerta vermelho nasce no instante em que a escolha é avaliada, para o curador ser avisado
-- na hora. Mas a aderência é escondida do participante até o fim do teste: contar esse alerta no
-- painel dele (alertas_abertos) revelaria, no meio do teste, que a última escolha foi avaliada
-- com aderência 10. Agora a view só conta alertas de testes concluídos.
--
-- Mesmas colunas, mesmos tipos, mesma ordem: CREATE OR REPLACE VIEW basta.
CREATE OR REPLACE VIEW "leadership_lab"."vw_painel_participante" AS
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
    WHERE sa."participante_id" = p."id"
      AND sa."status" = 'concluida'
      AND a."status" = 'aberto'
  )                                                                      AS "alertas_abertos"
FROM "leadership_lab"."participante" p
LEFT JOIN "leadership_lab"."sessao" s
  ON s."participante_id" = p."id" AND s."status" = 'concluida'
LEFT JOIN "leadership_lab"."resultado" r ON r."sessao_id" = s."id"
GROUP BY p."id";
