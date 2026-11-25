# Cenários do Leadership Lab (fixtures)

40 cenários de treinamento interativo, 10 por público, escritos para a equipe **revisar**. Todos usam
o pacote de cena `escritorio-gestao` e o campo `publico`:

| Público                      | Arquivos                             |
| ---------------------------- | ------------------------------------ |
| `supervisor-manutencao-adm`  | `supervisor-manutencao-adm-sup-*`    |
| `coordenador-administrativo` | `coordenador-administrativo-coord-*` |
| `rh`                         | `rh-rh-*`                            |
| `administrativo-geral`       | `administrativo-geral-adm-*`         |

`_indice.json` lista os 40 (arquivo, id, título, público, status).

**Aviso de conteúdo.** Os textos são exemplos. Nenhum cita norma, número ou limite, e cada
procedimento está marcado `[EXEMPLO a validar pela área responsável]`. Um cenário só vira `aprovado`
depois de revisado pela área dona do tema (segurança do trabalho, RH, jurídico, financeiro), e quem
aprova fica no `AuditLog`.

## Formato e importação

Os arquivos estão no formato do pacote de autoria, quase igual ao do projeto
(`packages/shared/src/treinamento-schema.ts`). O adaptador `adaptarCenarioDoPacote`
(`treinamento-importacao.ts`) faz a diferença, e o resultado passa pelo **mesmo** validador do projeto:

| Pacote             | Projeto                                            |
| ------------------ | -------------------------------------------------- |
| `id`               | `slug`                                             |
| (não existe)       | `summary` (a primeira legenda da introdução)       |
| (não existe)       | `intro.title` (= `title`) e `exemplo: true`        |
| `locale`, `status` | descartados (a situação nasce `rascunho` no banco) |
| `publico`          | `publico` (opcional)                               |
| `questions[].time` | texto curto livre (`"14:05"` ou `"Segunda, 08h"`)  |

Importar em lote (ADMIN e DEV), como **rascunho**, versão 1, sem aprovar nada:

```
POST /api/v1/treinamentos/cenarios/importar
{ "cenarios": [ { ...conteúdo de cada arquivo... } ] }
```

Resposta: `{ criados, jaExistem, invalidos, itens[] }`, com os problemas por caminho
(`questions.2.alternatives.1.beat.title`) de cada item inválido. Repetir a importação não duplica
(`ja_existe`). `POST /treinamentos/cenarios/validar` também aceita o formato do pacote.

## O que os testes garantem

- os 40 passam no validador; com **todas** as decisões cumpridas o resultado é tudo `ok`, e com
  **nenhuma**, tudo `bad` (`packages/shared/src/treinamento-importacao.test.ts`);
- só usam os cinco planos (`mesa`, `tela`, `reuniao`, `documento`, `relogio`) e os três comandos
  (`ok`, `alerta`, `falha`) do pacote de cena;
- o participante nunca recebe o gabarito (`taken`, `beat`, regras, procedimentos): na visão pura e
  nas respostas da API de um cenário importado, aprovado e atribuído.
