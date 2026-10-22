-- Permissões por perfil (recurso:ação) e o perfil Aprovador.
-- Tudo idempotente e aditivo: nada é removido nem sobrescrito. Os códigos precisam ficar iguais ao catálogo em
-- packages/shared/src/permissions.ts (há um teste que compara os dois).

-- 1) Catálogo de permissões. As que já existiam (seed antigo) são mantidas como estão.
INSERT INTO "Permission" ("id", "code", "description", "updatedAt") VALUES
  (gen_random_uuid(), 'auth:me', 'Consultar a própria sessão. Ver os dados da própria conta e as permissões do perfil.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'users:create', 'Criar usuários. Cadastrar usuários com perfil abaixo do seu.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'users:invite', 'Convidar usuários. Enviar convites de acesso a novos usuários.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'users:manage', 'Gerenciar usuários. Listar usuários, ativar/desativar, desbloquear contas e alterar o perfil de um usuário.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'permissions:manage', 'Gerenciar permissões dos perfis. Definir o que cada perfil pode acessar.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'scope:manage', 'Gerenciar escopos de acesso. Definir a quais unidades cada usuário tem acesso.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'audit:read', 'Consultar a auditoria. Ver o registro de operações administrativas e decisões.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'employees:manage', 'Gerenciar colaboradores. Criar, editar e arquivar colaboradores.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'leaves:manage', 'Gerenciar afastamentos. Registrar, alterar e cancelar férias, licenças e atestados.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'substitutions:manage', 'Configurar substituições. Definir quem cobre um colaborador durante as férias.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:read', 'Consultar escalas. Ver escalas, versões, pendências e o histórico de decisões.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:generate', 'Gerar escalas. Gerar a escala mensal de uma unidade.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:edit', 'Editar escalas. Ajustar células e atribuições de uma escala gerada.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:submit', 'Enviar escalas para aprovação. Enviar (ou reenviar) uma escala para análise.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:approve', 'Aprovar escalas. Aprovar uma escala enviada para análise.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:reject', 'Reprovar escalas. Reprovar uma escala, informando o motivo.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:publish', 'Publicar escalas. Publicar uma escala já aprovada.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules:archive', 'Excluir escalas. Remover uma versão de escala da lista (fica registrada no histórico).', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- 2) Perfil Aprovador (só existe se o banco já tiver perfis; um banco novo recebe os perfis pelo seed).
INSERT INTO "Role" ("id", "name", "level", "description", "updatedAt")
SELECT gen_random_uuid(), 'APPROVER', 2, 'Analisa e decide (aprova ou reprova) as escalas enviadas pelo RH.', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Role")
ON CONFLICT ("name") DO NOTHING;

-- 3) Permissões padrão de cada perfil. Só INSERE o que falta; uma permissão que o administrador já tenha
--    retirado de um perfil não volta depois desta migração (ela roda uma única vez por banco).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON (r."name"::text, p."code") IN (
    ('DEV', 'auth:me'),
    ('DEV', 'users:create'),
    ('DEV', 'users:invite'),
    ('DEV', 'users:manage'),
    ('DEV', 'permissions:manage'),
    ('DEV', 'scope:manage'),
    ('DEV', 'audit:read'),
    ('DEV', 'employees:manage'),
    ('DEV', 'leaves:manage'),
    ('DEV', 'substitutions:manage'),
    ('DEV', 'schedules:read'),
    ('DEV', 'schedules:generate'),
    ('DEV', 'schedules:edit'),
    ('DEV', 'schedules:submit'),
    ('DEV', 'schedules:approve'),
    ('DEV', 'schedules:reject'),
    ('DEV', 'schedules:publish'),
    ('DEV', 'schedules:archive'),
    ('ADMIN', 'auth:me'),
    ('ADMIN', 'users:create'),
    ('ADMIN', 'users:invite'),
    ('ADMIN', 'users:manage'),
    ('ADMIN', 'permissions:manage'),
    ('ADMIN', 'scope:manage'),
    ('ADMIN', 'audit:read'),
    ('ADMIN', 'employees:manage'),
    ('ADMIN', 'leaves:manage'),
    ('ADMIN', 'substitutions:manage'),
    ('ADMIN', 'schedules:read'),
    ('ADMIN', 'schedules:generate'),
    ('ADMIN', 'schedules:edit'),
    ('ADMIN', 'schedules:submit'),
    ('ADMIN', 'schedules:approve'),
    ('ADMIN', 'schedules:reject'),
    ('ADMIN', 'schedules:publish'),
    ('ADMIN', 'schedules:archive'),
    ('RH', 'auth:me'),
    ('RH', 'users:create'),
    ('RH', 'users:invite'),
    ('RH', 'employees:manage'),
    ('RH', 'leaves:manage'),
    ('RH', 'substitutions:manage'),
    ('RH', 'schedules:read'),
    ('RH', 'schedules:generate'),
    ('RH', 'schedules:edit'),
    ('RH', 'schedules:submit'),
    ('RH', 'schedules:publish'),
    ('RH', 'schedules:archive'),
    ('APPROVER', 'auth:me'),
    ('APPROVER', 'schedules:read'),
    ('APPROVER', 'schedules:approve'),
    ('APPROVER', 'schedules:reject'),
    ('COMUM', 'auth:me'),
    ('COMUM', 'schedules:read')
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 4) Todo DEV precisa de escopo global (regra que a API já impunha na criação). A autorização deixa de tratar o
--    perfil DEV como atalho de escopo e passa a olhar o escopo de fato; isto garante que contas DEV antigas o tenham.
INSERT INTO "UserScope" ("id", "userId", "isGlobal", "updatedAt")
SELECT gen_random_uuid(), u."id", true, CURRENT_TIMESTAMP
FROM "User" u
JOIN "Role" r ON r."id" = u."roleId"
WHERE r."name" = 'DEV'
  AND NOT EXISTS (
    SELECT 1 FROM "UserScope" s WHERE s."userId" = u."id" AND s."isGlobal" = true AND s."status" = 'ACTIVE'
  );
