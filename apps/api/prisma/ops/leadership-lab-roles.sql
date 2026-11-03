-- Leadership Lab — papel de banco do serviço de IA (menor privilégio).
--
-- O serviço de IA (Python, Google ADK) guarda as conversas em leadership_lab_ia e
-- NÃO precisa ler nada do RH nem do schema leadership_lab (aderência, perfis,
-- resultados). Este script cria um papel de grupo que só enxerga o seu schema.
--
-- NÃO roda pelo Prisma Migrate: papéis são do cluster e, no Cloud SQL, usuários são
-- criados pelo console ou pelo gcloud. Rode uma vez por ambiente, com um usuário
-- administrador, depois da migração 0015_leadership_lab:
--
--   psql -v ON_ERROR_STOP=1 -f leadership-lab-roles.sql "$DATABASE_URL_ADMIN"
--
-- Depois crie o usuário de login do serviço. A senha vem do Secret Manager, nunca
-- do Git:
--
--   CREATE USER lab_ia_service LOGIN PASSWORD '<do Secret Manager>' IN ROLE lab_ia_rw;
--   ALTER ROLE lab_ia_service SET search_path = leadership_lab_ia;
--
-- É idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lab_ia_rw') THEN
    CREATE ROLE lab_ia_rw NOLOGIN;
  END IF;
END
$$;

-- O serviço cria e mantém as próprias tabelas (sessions, events, app_states,
-- user_states) no schema dele.
GRANT USAGE, CREATE ON SCHEMA leadership_lab_ia TO lab_ia_rw;

-- Garantia explícita de que ele não enxerga os dados de avaliação.
REVOKE ALL ON SCHEMA leadership_lab FROM lab_ia_rw;
