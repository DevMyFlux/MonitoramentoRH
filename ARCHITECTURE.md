# MY FLUX Architecture

## Fonte de verdade

O arquivo fornecido pelo usuário `MY_FLUX_PROMPT_MESTRE_V2.md` é a especificação oficial do produto. Decisões de arquitetura, permissões, workflows, auditoria, scopes e ordem de implementação seguem esse documento.

## Monorepo

```text
apps/
  api/   REST API versionada em /api/v1
  web/   React SPA com Vite
packages/
  config/      constantes e configuracao compartilhada
  shared/      utilitarios compartilhados sem dependencia de runtime especifico
  types/       tipos de dominio e contratos base
  validation/  schemas Zod compartilhados
```

## Camadas

A aplicacao deve manter a separacao obrigatoria:

```text
UI
Application / Services
Repositories
Persistence
```

No backend, os módulos maduros usam repositories; os fluxos novos de recrutamento e escala usam services transacionais próximos às rotas enquanto a separação é consolidada.

No frontend, componentes React nao acessam banco. A comunicacao externa passa por uma camada central de API client.

## API

Toda API publica do backend deve usar o prefixo `/api/v1` e retornar erros padronizados:

```json
{
  "code": "ERROR_CODE",
  "message": "Mensagem compreensivel.",
  "details": {}
}
```

## Seguranca

A hierarquia oficial e:

```text
DEV > ADMIN > RH > COMUM
```

Role e scope sao conceitos separados. Toda autorizacao relevante precisa existir no backend; ocultar controles no frontend nao e seguranca.

## Auditoria

Auditoria e infraestrutura obrigatoria desde a fundacao. As proximas etapas devem registrar acoes criticas em `AuditLog`, mantendo historico append-only no fluxo normal da aplicacao.

## Persistencia

Prisma esta preparado para PostgreSQL. As migrations devem preservar IDs unicos, timestamps e trilha de auditoria conforme as entidades forem implementadas.
