# Módulos ocultos

Um módulo **oculto** não existe para ninguém: nem para DEV. Não aparece no menu, na busca, no
assistente nem em outras telas; a URL direta cai na página 404 e a API responde o mesmo 404 de uma
rota que nunca existiu (para os 4 perfis e para quem nem tem sessão). O **código continua no
repositório**, continua compilando e passando nos testes, e o **banco e as migrações ficam como
estão** (sem `DROP`), para o módulo poder ser religado depois sem recriar nada.

## Quais estão ocultos hoje

| Módulo       | Onde mora o código                                                        | Observação                                                  |
| ------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| QLP          | `apps/api/src/_hidden/qlp/`, `apps/web/src/_hidden/qlp/`                  | Inclui `/positions` (listar, criar e alocar a uma posição). |
| Recrutamento | `apps/api/src/_hidden/recruitment/`, `apps/web/src/_hidden/recrutamento/` | Depende das posições do QLP.                                |

A lista vive em **um só lugar**: `packages/shared/src/modules.ts` (campo `status`). A API, o
roteador, o menu, o assistente e as regras de acesso (`can()`) leem dele.

## Como religar (uma linha)

Em `packages/shared/src/modules.ts`, troque `status: "hidden"` por `status: "active"` (ou apague o
campo) no módulo desejado:

```ts
modulo("qlp", "QLP", ["/qlp"], { apiPrefixos: ["/qlp", "/positions"] }),
```

Isso religa tudo de uma vez:

- **API:** `registrarModulosOcultos` (`apps/api/src/_hidden/registrar.ts`) passa a registrar as
  rotas do módulo.
- **Web:** `rotasOcultas` (rota), `itensDeMenuOcultos` (menu) e `contextosOcultos` (assistente), em
  `apps/web/src/_hidden/`, passam a devolver o módulo.
- **Telas que o citavam:** o painel inicial (indicadores de posições e vagas, painel de cobertura,
  passos "Planejamento" e "Recrutamento") e a tela de Escalas (cartões "Necessário", "Coberto" e
  "Cobertura") só mostram essas peças com o QLP ativo; o código delas está em
  `apps/web/src/_hidden/qlp/` (`dashboard-qlp.tsx`, `metricas-de-cobertura.tsx`).
- **Perfil COMUM:** a trava do COMUM continua negando por padrão. Para o COMUM enxergar um módulo
  religado, marque `comumPode: true` no registro (não é o caso do QLP nem do Recrutamento).

Se o módulo religado precisar de algo que mudou enquanto estava oculto, o compilador (`pnpm
typecheck`) e os testes avisam: ele é compilado e testado como qualquer outro.

## O que NÃO é módulo oculto

Endpoints de cadastro compartilhados (`/operations`, `/functions`, `/parameters`, `/event-types`,
`/documents`, `/calendar`) alimentam as telas ativas (Colaboradores e Escalas) e por isso **não**
são escondidos: esconde-se a _tela_, nunca o endpoint compartilhado. O mesmo vale para o cálculo de
cobertura que a escala já grava em `generatedResult.metrics`: o dado continua sendo gravado (é
inofensivo e volta a ser exibido ao religar o QLP), só não é mostrado nem entregue ao assistente.

O código "C" (**Cobertura**) da legenda da escala é um tipo de turno que o usuário lança na escala,
não o indicador do QLP, e por isso continua nas telas ativas.

## Atualizações silenciosas e CI

O módulo oculto acompanha o resto do código: mudanças de contrato em `packages/shared`,
`packages/validation` ou `packages/types` quebram o `typecheck` dele como o de qualquer outro.
O job **Módulos ocultos** (`.github/workflows/modulos-ocultos.yml`) roda o typecheck do repositório
e `pnpm test:ocultos`:

- `packages/shared`: `modules.test.ts` e `acessos.test.ts` (o registro e a decisão de acesso);
- API: `src/_hidden` (404 para os 4 perfis e sem sessão; religar traz as rotas de volta) e
  `comum-guard.test.ts` (o COMUM recebe 404, e não 403, nas rotas ocultas);
- Web: `src/_hidden` (roteador, menu, dock, assistente, textos proibidos nas telas ativas).

Os testes do próprio código do QLP (`qlp-calculator`, `qlp-workflow`) ficam junto dele em
`apps/api/src/_hidden/qlp/` e rodam na suíte normal.
