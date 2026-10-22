# Perfis, permissões e acesso — MY FLUX

## Princípio

A autorização é decidida por **permissão** (`recurso:ação`), nunca pelo nome do perfil. O título "Desenvolvedor", sozinho, não
concede nada: o que vale é o conjunto de permissões que o banco entrega para a conta. Esconder um botão na tela não é
segurança — **toda** operação é validada no servidor (`requirePermission`), e a tela só evita oferecer o que o perfil não pode.

```text
Perfil ──(RolePermission, editável pelo administrador)──▶ permissões ──▶ o que a API deixa fazer
Conta ──(UserScope)──▶ escopo (empresa / operação / unidade / global) ──▶ ONDE pode fazer
```

`role` (o que) e `scope` (onde) continuam independentes. Acesso a todas as unidades vem de um **escopo global** (`isGlobal`), não do
perfil: todo DEV é criado com escopo global, e a migração `0016` garante isso para contas DEV antigas.

## Perfis

| Perfil | Para quê | Permissões padrão |
|---|---|---|
| `DEV` | Administrador técnico | todas |
| `ADMIN` | Administrador | todas |
| `RH` | Opera as escalas | colaboradores, afastamentos, substituições, gerar/editar/enviar/publicar/excluir escalas, criar/convidar usuários |
| `APPROVER` | Aprova ou reprova escalas | consultar escalas, aprovar, reprovar |
| `COMUM` | Consulta | consultar escalas |

O **Aprovador** não edita colaboradores, rodízios, atribuições nem o conteúdo das escalas: só consulta e decide.
O **RH** não aprova nem reprova, e não publica uma escala que não esteja aprovada.

### Hierarquia de delegação

`DEV (4) > ADMIN (3) > RH = APPROVER (2) > COMUM (1)`. Não é um privilégio: só impede escalada — ninguém cria, gerencia ou edita as
permissões de um perfil igual ou acima do seu (o DEV, no topo, pode gerir os demais e o próprio, preservando o que é protegido).

## Catálogo de permissões

Fonte única: `packages/shared/src/permissions.ts`. A migração `0016_permissions_and_approver` popula o banco com o mesmo catálogo
(há um teste que compara os dois).

| Grupo | Permissão | O que libera |
|---|---|---|
| Acesso | `auth:me` | consultar a própria sessão (nenhum perfil perde) |
| | `users:create` / `users:invite` | criar / convidar usuários (perfil abaixo do seu) |
| | `users:manage` | listar usuários, ativar/desativar, desbloquear, trocar perfil |
| | `permissions:manage` | definir o que cada perfil pode acessar |
| | `scope:manage` | definir escopos de acesso |
| | `audit:read` | consultar a auditoria |
| Cadastros | `employees:manage` | criar, editar e arquivar colaboradores |
| | `leaves:manage` | registrar, alterar e cancelar afastamentos |
| | `substitutions:manage` | configurar substituições temporárias |
| Escalas | `schedules:read` | consultar escalas, versões, pendências e histórico |
| | `schedules:generate` | gerar a escala mensal |
| | `schedules:edit` | ajustar células/atribuições |
| | `schedules:submit` | enviar para aprovação |
| | `schedules:approve` / `schedules:reject` | aprovar / reprovar |
| | `schedules:publish` | publicar escala aprovada |
| | `schedules:archive` | excluir uma versão da lista |

## Alterando permissões (administrador)

Tela **Perfis e permissões** (`/perfis`) ou `PUT /api/v1/roles/:perfil/permissions`. As regras valem no servidor:

1. só códigos do catálogo;
2. só perfis **abaixo** do seu (o DEV também edita o próprio);
3. **não se concede o que não se possui** (sem escalada de privilégio);
4. permissões **protegidas** não saem: `auth:me` de ninguém; e do DEV, também `users:manage` e `permissions:manage` (evita trancar o sistema).

A mudança vale na **próxima requisição** de cada usuário (as permissões são lidas do banco a cada chamada), sem novo login, e fica na
auditoria (`PERMISSION_CHANGE`, com antes, depois e justificativa).

## Contas

- **Trocar o perfil de um usuário** (`PATCH /users/:id/role`): não se atribui perfil igual ou acima do seu; ninguém troca o próprio perfil; o último
  DEV ativo é preservado; as sessões da pessoa são revogadas; registra `ROLE_CHANGE`.
- **Desativar** (`PATCH /users/:id/status`): derruba o acesso na hora (o token antigo para de valer); ninguém desativa a própria conta.
- **Bloqueio por tentativas**: 5 senhas erradas seguidas bloqueiam a conta por 15 minutos; um administrador pode desbloquear
  (`POST /users/:id/unlock`). Quem erra a senha não descobre se o e-mail existe nem se a conta está bloqueada — essas mensagens só
  aparecem depois de a senha estar correta.
- **Segredos de produção**: `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` são obrigatórios (e diferentes entre si); sem eles o servidor
  **não sobe** em `NODE_ENV=production`.
- **Login automático**: removido do produto. Só existe no servidor de desenvolvimento, e só se `VITE_DEV_AUTO_LOGIN=true` com
  `VITE_DEV_AUTO_LOGIN_EMAIL/PASSWORD` em `.env.local` (fora do git). Nenhuma senha fica escrita no código.

## Fluxo da escala

```text
DRAFT ──schedules:submit──▶ IN_REVIEW ──schedules:approve──▶ APPROVED ──schedules:publish──▶ PUBLISHED
```

Não existe publicação que pule a aprovação (o antigo "override de DEV" nunca foi implementado e foi removido).

## Auditoria

Ações críticas criam registros em `AuditLog` com usuário, perfil, entidade, id, antes/depois e origem. A tela de auditoria exige `audit:read`.

## Módulos ainda por perfil (legado)

QLP, recrutamento, avaliações, aptidão, importações, parâmetros e relatórios continuam decididos por lista de perfis no código
(estão ocultos no menu). Quem não está na lista — inclusive o novo Aprovador — é negado por padrão. Migrá-los para permissões é o próximo passo natural.
