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
- `comum@myflux.local` — `COMUM`, escopo da Operação Demonstrativa.

O `demo-seed` cria a operação demonstrativa parametrizada e dados de exemplo. Troque as senhas antes de qualquer uso real.

O web padrão fica em `http://localhost:5173` e a API em `http://localhost:3333/api/v1`. O script local usa as portas `5175` e `3334` para permitir manter outro ambiente em execução.

## Qualidade

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Em ambientes Windows gerenciados que bloqueiam criação de processos, testes e build podem retornar `spawn EPERM`; lint e TypeScript podem ser executados individualmente.

## Domínio e segurança

- Autorização aplicada no backend; `role` e `scope` são independentes.
- QLP operacional aprovado materializa posições; posições sem origem são bloqueadas.
- Aptidão retorna status e `reasonCodes`; requisito crítico ausente ou vencido bloqueia alocação.
- Escala mensal calcula aptidão, disponibilidade, jornada e conflitos no servidor.
- Importações passam por staging e só o commit efetiva colaboradores.
- Entidades críticas usam histórico e arquivamento.
- Usuários demonstrativos são definidos em `apps/api/prisma/seed.ts`; os exemplos operacionais, em `apps/api/prisma/demo-seed.ts`.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md), [docs/permissions.md](docs/permissions.md) e [docs/domain-decisions.md](docs/domain-decisions.md).
