# MY FLUX

Sistema integrado de gestão operacional de pessoas. O fluxo central é:

`organização → QLP aprovado → posições → recrutamento → colaborador → aptidão → eventos → escala → aprovação → publicação → auditoria`

## Manual do sistema

Consulte o [Manual MyFlux](docs/MANUAL_MY_FLUX.md) para iniciar banco, API e frontend em terminais separados, acessar as contas demonstrativas e testar o fluxo completo. O manual também registra as limitações da implementação atual.

## Executar localmente

Requisitos: Node.js 22+ e pnpm 11+.

```powershell
pnpm install
pnpm db:generate
pnpm dev
```

Com PostgreSQL local isolado no diretório `.local`, mantenha o banco aberto em um terminal:

```powershell
pnpm install
node scripts/local-db.mjs
```

Em outro terminal PowerShell, na raiz do projeto, prepare a base:

```powershell
node scripts/run-local.mjs generate
node scripts/run-local.mjs migrate
$env:DATABASE_URL = 'postgresql://my_flux:my_flux_local@127.0.0.1:55432/my_flux'
node apps/api/node_modules/tsx/dist/cli.mjs apps/api/prisma/seed.ts
node scripts/run-local.mjs seed
node scripts/run-local.mjs api
```

Inicie `node scripts/run-local.mjs web` em um terceiro terminal e abra [o login local](http://localhost:5175/login). Não é necessário repetir os seeds a cada inicialização: o seed base redefine as senhas demonstrativas e reativa essas contas.

O seed base cria estas contas locais de demonstração, todas com a senha inicial `ChangeMe!2026`:

- `dev@myflux.local` — `DEV`, escopo global;
- `admin@myflux.local` — `ADMIN`, escopo da Operação Demonstrativa;
- `rh@myflux.local` — `RH`, escopo da Operação Demonstrativa;
- `approver@myflux.local` — `APPROVER` (Aprovador), escopo da Operação Demonstrativa;
- `comum@myflux.local` — `COMUM`, escopo da Operação Demonstrativa.

O `demo-seed` cria a operação demonstrativa parametrizada e dados de exemplo. Troque as senhas antes de qualquer uso real.

O login é sempre exigido. Para entrar sozinho **apenas no servidor de desenvolvimento**, crie `apps/web/.env.local` (fora do git) com `VITE_DEV_AUTO_LOGIN=true`, `VITE_DEV_AUTO_LOGIN_EMAIL` e `VITE_DEV_AUTO_LOGIN_PASSWORD`. Em produção esse atalho não existe.

O web padrão fica em `http://localhost:5173` e a API em `http://localhost:3333/api/v1`. O script local usa as portas `5175` e `3334` para permitir manter outro ambiente em execução.

## Qualidade

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Testes de integração (opcional)

Os arquivos `*.integration.test.ts` exercitam a API com um Postgres de verdade (permissões por perfil, bloqueio de conta, migrações). Eles só rodam se
`TEST_DATABASE_URL` apontar para um banco **de teste** (nunca o de desenvolvimento — os testes criam dados); o setup aplica as migrações e a seed:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://my_flux:my_flux_local@127.0.0.1:55432/my_flux_test'
pnpm --filter @my-flux/api test
```

Sem a variável, esses testes são pulados e `pnpm test` não precisa de banco.

Em ambientes Windows gerenciados que bloqueiam criação de processos, testes e build podem retornar `spawn EPERM`; lint e TypeScript podem ser executados individualmente.

## Domínio e segurança

- Autorização aplicada no backend, por **permissão** (não pelo nome do perfil); `role` e `scope` são independentes. Em produção, `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` são obrigatórios.
- QLP operacional aprovado materializa posições; posições sem origem são bloqueadas.
- Aptidão retorna status e `reasonCodes`; requisito crítico ausente ou vencido bloqueia alocação.
- Escala mensal calcula aptidão, disponibilidade, jornada e conflitos no servidor.
- Importações passam por staging e só o commit efetiva colaboradores.
- Entidades críticas usam histórico e arquivamento.
- Usuários demonstrativos são definidos em `apps/api/prisma/seed.ts`; os exemplos operacionais, em `apps/api/prisma/demo-seed.ts`.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md), [docs/permissions.md](docs/permissions.md) e [docs/domain-decisions.md](docs/domain-decisions.md).
