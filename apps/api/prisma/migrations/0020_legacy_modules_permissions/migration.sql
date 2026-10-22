-- Permissões dos módulos que ainda decidiam o acesso pelo NOME do perfil (cadastros-mestre, aptidão, avaliações,
-- importações, QLP/posições, parâmetros e recrutamento). Passam a ser decididos por permissão, editável pelo
-- administrador. Tudo idempotente e aditivo; os códigos precisam ficar iguais ao catálogo em
-- packages/shared/src/permissions.ts (há um teste que compara os dois).
--
-- A matriz padrão é IDÊNTICA à regra que existia no código — nenhum perfil ganha nem perde acesso:
--   cadastros-mestre, parâmetros, QLP (e escala por QLP) ....... DEV, ADMIN
--   aptidão, avaliações, posições, recrutamento ................. DEV, ADMIN, RH
--   importação de qualquer base ................................. DEV, ADMIN
--   importação só de colaboradores .............................. DEV, ADMIN, RH

-- 1) Catálogo de permissões.
INSERT INTO "Permission" ("id", "code", "description", "updatedAt") VALUES
  (gen_random_uuid(), 'masterdata:manage', 'Gerenciar cadastros-mestre. Criar, editar e arquivar empresas, clientes, unidades, contratos, operações, serviços, obrigações e funções.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'aptitude:manage', 'Gerenciar aptidão. Cadastrar requisitos, documentos e competências usados no cálculo de aptidão.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'evaluations:manage', 'Gerenciar avaliações. Criar avaliações e conduzi-las pelo fluxo de análise do RH.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'imports:run', 'Importar bases (todos os tipos). Importar qualquer base: colaboradores, funções, requisitos e demais.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'imports:employees', 'Importar colaboradores. Importar somente a base de colaboradores.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'qlp:manage', 'Gerenciar o QLP. Criar versões do QLP, aprová-las e arquivá-las, e gerar a escala a partir do QLP.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'positions:assign', 'Atribuir colaboradores às posições. Alocar colaboradores nas posições do quadro.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'parameters:manage', 'Gerenciar parâmetros. Cadastrar e alterar parâmetros da operação, como turnos.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'recruitment:manage', 'Gerenciar recrutamento. Conduzir vagas, candidatos e candidaturas.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- 2) Matriz padrão. Só INSERE o que falta (uma permissão que o administrador retire depois não volta).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON (r."name"::text, p."code") IN (
    ('DEV', 'masterdata:manage'),
    ('DEV', 'aptitude:manage'),
    ('DEV', 'evaluations:manage'),
    ('DEV', 'imports:run'),
    ('DEV', 'imports:employees'),
    ('DEV', 'qlp:manage'),
    ('DEV', 'positions:assign'),
    ('DEV', 'parameters:manage'),
    ('DEV', 'recruitment:manage'),
    ('ADMIN', 'masterdata:manage'),
    ('ADMIN', 'aptitude:manage'),
    ('ADMIN', 'evaluations:manage'),
    ('ADMIN', 'imports:run'),
    ('ADMIN', 'imports:employees'),
    ('ADMIN', 'qlp:manage'),
    ('ADMIN', 'positions:assign'),
    ('ADMIN', 'parameters:manage'),
    ('ADMIN', 'recruitment:manage'),
    ('RH', 'aptitude:manage'),
    ('RH', 'evaluations:manage'),
    ('RH', 'imports:employees'),
    ('RH', 'positions:assign'),
    ('RH', 'recruitment:manage')
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
