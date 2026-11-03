# Leadership Lab — banco de dados

Módulo de treinamento de gestores do MY FLUX. Este documento cobre a **Etapa 1 (banco de dados)**. As demais etapas acrescentam seções aqui.

## Schemas

| Schema              | Quem cria as tabelas     | Conteúdo                                                                         |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `leadership_lab`    | Prisma (`schema.prisma`) | 17 tabelas do módulo e a view `vw_painel_participante`                           |
| `leadership_lab_ia` | O serviço de IA (Python) | Sessões do Google ADK. A migração só cria o schema vazio; o Prisma não o enxerga |

As tabelas do RH continuam em `public`. Nenhuma ganhou coluna: `User`, `Employee` e `JobFunction` só ganharam campos virtuais do Prisma (relações inversas), sem alteração no banco. O `schema.prisma` usa `multiSchema`, por isso todo modelo e enum tem `@@schema(...)`; **novos modelos precisam do seu**.

## Decisões de modelagem

- **`participante`** liga um login (`User`) a um colaborador (`Employee`), um para um. Todas as tabelas do módulo apontam para ele. Não existe vínculo `User`↔`Employee` no RH, e `Employee` não tem e-mail, então o vínculo é cadastrado pelo RH.
- **`molde_cargo`** mapeia um cargo do RH (`JobFunction`) para um molde. Uma função pertence a no máximo um molde.
- **`permissao_usuario`** guarda `lab_gestao` e `lab_especialista` por usuário (as tabelas `Permission`/`RolePermission` do RH são por perfil e não são usadas pelo código). Revogar apaga a linha; o histórico fica em `AuditLog` (`PERMISSION_CHANGE`).
- **Valores fechados são `TEXT` + `CHECK`**, não enums do Postgres. As listas do código estão em `packages/shared/src/leadership-lab.ts`, e um teste confere que banco e código dizem o mesmo.
- **Regras de domínio no banco**, para valerem mesmo que algum código as esqueça: escala de aderência (100, 70, 40, 10, 0); 0 só por tempo esgotado; alerta vermelho se, e somente se, aderência 10; sempre 3 respostas; marco é a situação 3; campo livre só é gravado depois da Guarda (texto bloqueado nunca é gravado); resultado só deixa "aguardando validação" com quem validou e quando; ajuste exige justificativa; encerrar alerta exige a nota da conversa.
- **Moldes entram inativos e sem tempo limite.** O tempo por situação é decisão de negócio em aberto; o banco recusa ativar um molde sem tempo.
- **Só o modo `dinamico` existe no piloto.** `validado` e `teste_versao_id` entram na versão 1, com as tabelas de testes validados.
- **Colunas de ator** (`validado_por`, `tratado_por`, `decidido_por`, `criado_por`...) são o UUID do usuário sem FK, a mesma convenção de `createdBy`/`updatedBy` do restante do repositório. A trilha completa fica em `AuditLog`.
- **FKs `RESTRICT`** por padrão (nada some em cascata); `CASCADE` só em tabelas de ligação. A política de retenção, ainda em aberto com o jurídico, definirá como expurgar.
- **`log_ia` é uma tabela comum**, indexada por data, sem partição mensal: para 8 a 12 líderes o volume não justifica. Particionar quando houver volume.

## Operação

Aplicar (mesmo fluxo de produção, `prisma migrate deploy`):

```bash
pnpm --filter @my-flux/api exec prisma migrate deploy
```

Desfazer. O Prisma Migrate não executa descida, então o arquivo é aplicado à mão. É **destrutivo** (apaga os dados do Lab) e atômico; ele falha, sem desfazer nada, se o serviço de IA já criou tabelas em `leadership_lab_ia`:

```bash
psql -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/0015_leadership_lab/down.sql "$DATABASE_URL"
```

Papel de banco do serviço de IA (menor privilégio: só enxerga `leadership_lab_ia`). Rodar uma vez por ambiente, com usuário administrador, depois da migração. O script explica como criar o usuário de login, com a senha vinda do Secret Manager:

```bash
psql -v ON_ERROR_STOP=1 -f apps/api/prisma/ops/leadership-lab-roles.sql "$DATABASE_URL_ADMIN"
```

## Testes de integração

Usam um PostgreSQL real e criam um banco descartável por suíte. Sem `LAB_TEST_DATABASE_URL` são ignorados, não falham. Com o banco embutido do projeto:

```bash
node scripts/local-db.mjs
```

```bash
LAB_TEST_DATABASE_URL=postgresql://my_flux:my_flux_local@127.0.0.1:55432/postgres pnpm --filter @my-flux/api test
```

O usuário precisa poder criar bancos e papéis (superusuário, no banco embutido).

## Pendências desta etapa

- Limite de testes por dia: decisão de negócio em aberto. Por ora é a variável `LAB_LIMITE_TESTES_DIA` do backend; se virar configuração editável, entra uma tabela na Etapa 3.
- Política de falha da IA no meio de um teste (retomar, cancelar): Etapa 3. O status `cancelada` já existe.
- Tempo limite por situação de cada molde: decisão de negócio em aberto.
