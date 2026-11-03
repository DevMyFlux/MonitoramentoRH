-- Desfaz 0017_leadership_lab_painel_sem_vazamento: volta a view da 0015, que contava também os
-- alertas de testes em andamento. O Prisma Migrate não aplica este arquivo: rode-o à mão
-- (psql -v ON_ERROR_STOP=1 -f down.sql). Não toca em nenhum dado.
BEGIN;

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
    WHERE sa."participante_id" = p."id" AND a."status" = 'aberto'
  )                                                                      AS "alertas_abertos"
FROM "leadership_lab"."participante" p
LEFT JOIN "leadership_lab"."sessao" s
  ON s."participante_id" = p."id" AND s."status" = 'concluida'
LEFT JOIN "leadership_lab"."resultado" r ON r."sessao_id" = s."id"
GROUP BY p."id";

COMMIT;
