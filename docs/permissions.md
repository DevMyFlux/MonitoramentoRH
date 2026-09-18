# Permissoes MY FLUX

## Hierarquia

```text
DEV > ADMIN > RH > COMUM
```

Role e scope sao conceitos separados. Role decide o que o usuario pode fazer. Scope decide onde
ele pode fazer.

## Roles

- `DEV`: acesso tecnico maximo, incluindo override justificado em workflows.
- `ADMIN`: administra negocio, aprova/publica escala e consulta auditoria.
- `RH`: gerencia colaboradores, documentos, competencias, avaliacoes, calendario e envia fluxos para revisao.
- `COMUM`: perfil basico sem permissao de gestao nas rotas implementadas.

## Scopes

Scopes podem apontar para:

- empresa (`companyId`)
- operacao (`operationId`)
- unidade (`unitId`)
- global (`isGlobal`)

`DEV` ignora restricoes de scope por regra hierarquica. Outros perfis precisam ter scope compativel
com o recurso. O frontend pode ocultar controles, mas a autorizacao real fica no backend.

## Workflows

QLP:

- `DRAFT -> IN_REVIEW`: permitido aos perfis de gestao.
- `IN_REVIEW -> APPROVED`: permitido a ADMIN/DEV.

Avaliacoes:

- `DRAFT -> IN_RH_REVIEW`: RH/ADMIN/DEV.
- `IN_RH_REVIEW -> APPROVED/REJECTED`: RH/ADMIN/DEV.

Escalas:

- `DRAFT -> IN_REVIEW`: RH/ADMIN/DEV.
- `IN_REVIEW -> APPROVED`: ADMIN.
- `APPROVED -> PUBLISHED`: ADMIN.
- DEV pode override com justificativa.

## Auditoria

Acoes criticas criam registros em `AuditLog` com usuario, role, entidade, id, antes/depois e origem.
A tela de auditoria e restrita a DEV/ADMIN.
