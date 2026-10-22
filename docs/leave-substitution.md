# Substituição temporária durante afastamentos

Quando alguém entra de férias (ou em outro afastamento), outra pessoa pode **cobrir os plantões dele**. A
configuração fica ligada ao afastamento já cadastrado — não existe um módulo de férias paralelo — e as escalas
mensais são atualizadas a partir dela. Quem configura: `substitutions:manage` (RH, Administrador e Desenvolvedor por
padrão). Quem consulta: `schedules:read` (inclui o Aprovador). Tudo é conferido no servidor.

## Como o sistema entende "atividades" (interpretação a confirmar)

O sistema **não tem atividades por colaborador**: o que existe na escala é o plantão de cada dia (um código na
grade). Por isso a substituição trabalha com o que a grade conhece:

- **Plantão a cobrir** = cada dia do afastamento em que o titular trabalharia pelo rodízio (Par/Ímpar ou 5x2),
  ignorando o afastamento. É o que o responsável escolhe cobrir: todos, ou só alguns dias.
- **Cobertura** = o dia em que o substituto assume o plantão. Na grade dele vira **`C` (Cobertura)**, o código que o
  catálogo já previa para "dia extra explícito". A substituição é **aditiva**: o substituto mantém a escala dele e só
  ganha dias; o afastado continua com o código do afastamento (ex.: `FR`).

> Se na operação "atividade" significa outra coisa (por exemplo, tarefas dentro de um mesmo plantão), este é o ponto a
> revisar: o planejador (`substitution-planner.ts`) é uma função pura e isolada justamente para isso.

## Rodízio da substituição

| Opção                         | O que faz                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Habitual**                  | Cobre os plantões do titular **nos dias em que o substituto está de folga** pelo próprio rodízio. Nada muda no cadastro dele.                                                          |
| **Específico — Par ou Ímpar** | Cobre **só** os plantões que caem em dias Par (ou Ímpar), com a mesma regra de virada de mês do rodízio normal. Os demais ficam para outro substituto. Vale só para esta substituição. |

O Par/Ímpar específico é "verdadeiro em um mês" (o do início do afastamento); a classificação inverte depois de meses
de 31 dias, como em `docs/escalas-par-impar.md`. Exemplo de uso: titular **comercial 5x2** de férias, dois substitutos
12x36 — um cobre os dias Par, o outro os Ímpar. Para titular 12x36, o específico equivale a "tudo ou nada" (os plantões
dele já são de um só Par/Ímpar por mês).

## O que impede a cobertura de um dia (nunca em silêncio)

Cada dia que não pôde ser coberto vira uma **ocorrência** em linguagem simples (catálogo central
`friendly-messages.ts`), com o titular, o substituto, a data e o que fazer. Todas são alertas ou informações — **não
impedem** o envio para aprovação:

| Código                                                        | Quando                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SUBSTITUTION_SUBSTITUTE_ON_DUTY`                             | O substituto já trabalha nesse dia pelo próprio rodízio (não ocupa dois plantões). |
| `SUBSTITUTION_SUBSTITUTE_ON_LEAVE`                            | O substituto está afastado.                                                        |
| `SUBSTITUTION_SUBSTITUTE_NOT_ACTIVE`                          | Cadastro inativo, antes da admissão ou depois do desligamento.                     |
| `SUBSTITUTION_SUBSTITUTE_APTITUDE`                            | Documento/competência do substituto não está em dia (mesma regra da geração).      |
| `SUBSTITUTION_SUBSTITUTE_NOT_CONFIGURED` / `_NOT_IN_SCHEDULE` | Sem turno/rodízio ou fora da escala do mês.                                        |
| `SUBSTITUTION_SUBSTITUTE_ALREADY_COVERING`                    | O substituto já cobre outro colaborador nesse dia.                                 |
| `SUBSTITUTION_DAY_ALREADY_COVERED`                            | O plantão já tem outro substituto (info).                                          |
| `SUBSTITUTION_MANUAL_ADJUSTMENT`                              | O dia do substituto tem ajuste manual, que vale sobre a substituição (info).       |

Quando duas substituições disputam o mesmo dia, **a mais antiga (por criação) cobre**. Dias seguidos de trabalho
(substituto cobrindo o dia ao lado do próprio plantão) geram o aviso de descanso menor que o do turno
(`EDIT_REST_TIME_SHORT`), igual a uma edição manual, e ficam registrados na escala.

Uma configuração que **não cobriria nenhum plantão** é recusada (`SUBSTITUTION_NOTHING_TO_COVER`) com os motivos.

## Endpoints

| Rota                                                        | Permissão              | O que faz                                                                         |
| ----------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `GET /substitutions?leaveEventId=&employeeId=&operationId=` | `schedules:read`       | Lista (com situação: agendada, em vigor, encerrada, cancelada).                   |
| `POST /substitutions`                                       | `substitutions:manage` | Cria. `dryRun: true` só devolve o plano, sem gravar.                              |
| `PATCH /substitutions/:id`                                  | `substitutions:manage` | Altera substituto, rodízio, plantões ou observação. Recalcula.                    |
| `POST /substitutions/:id/cancel`                            | `substitutions:manage` | Cancela (motivo obrigatório). Desfaz as coberturas; o registro fica.              |
| `POST /substitutions/:id/apply`                             | `substitutions:manage` | Reaplica às escalas (idempotente) e confirma versões novas em escalas bloqueadas. |
| `PATCH /calendar/events/:id`                                | `leaves:manage`        | **Novo.** Altera datas/título/observação do afastamento; recalcula as coberturas. |
| `DELETE /calendar/events/:id`                               | `leaves:manage`        | Cancela o afastamento; encerra as substituições dele e desfaz as coberturas.      |

Corpo de `POST /substitutions`:

```json
{
  "leaveEventId": "…", "substituteId": "…",
  "rotation": "HABITUAL" | "SPECIFIC", "specificParity": "ODD" | "EVEN",
  "coveredDates": ["2026-10-13", "2026-10-15"], "notes": "…",
  "dryRun": false, "applyToLockedSchedules": false
}
```

A resposta traz `substitution`, `plan` (plantões, dias cobertos, dias deixados para outro Par/Ímpar, ocorrências já
traduzidas) e `schedules` (o que aconteceu com a escala de cada mês: `UPDATED`, `NEW_VERSION`, `UNCHANGED`,
`NO_SCHEDULE`, `NEEDS_CONFIRMATION`, `CONFLICT`, `NOT_SUPPORTED`, `FAILED`, com a mensagem).

## Como as escalas são atualizadas

A configuração é a fonte da verdade; a grade é consequência. Cada mês do afastamento é reconciliado assim:

1. **Só o que muda.** Comparam-se as células que a grade deve ter com as que tem; só as diferentes são alteradas, pelo
   mesmo caminho da edição de escala (validação, versão, histórico, auditoria). Nada é apagado e recriado.
2. **Idempotente.** Aplicar de novo a mesma configuração dá `UNCHANGED` e não muda a revisão nem o hash.
3. **Afastamento que atravessa meses.** Cada mês tem a sua escala; o Par/Ímpar acompanha a virada de mês.
4. **Rascunho ou reprovada:** atualizada na hora (revisão +1). O histórico (`ScheduleHistory`) registra quem, quando,
   de → para e o motivo (`origin: SUBSTITUTION`).
5. **Em análise, aprovada ou publicada:** **não é alterada em silêncio.** A resposta é `NEEDS_CONFIRMATION`; confirmar
   (`applyToLockedSchedules: true`) cria uma **nova versão em rascunho** — a análise/aprovação anterior deixa de valer e a
   publicada continua no ar até a nova ser publicada.
6. **Ajuste manual vence.** Um dia que alguém ajustou à mão não é tocado; a substituição registra a ocorrência.
7. **Mês sem escala gerada:** nada a atualizar (`NO_SCHEDULE`); a substituição entra quando a escala for gerada.

A cobertura **não vira "ajuste manual"** (`ScheduleDayOverride`): ela é derivada da configuração. Por isso encerra
sozinha: depois do último dia do afastamento nenhuma célula é gerada, sem operação manual. O registro das células de
cobertura fica em `generatedResult.substitutionCells`, para poder desfazê-las.

### Afastamento mudou de datas ou foi cancelado

`PATCH`/`DELETE` do afastamento recalculam as coberturas (as que saem voltam ao que o rodízio prevê) e conferem a
**linha do titular** no período afetado (o afastamento aparece ou some da grade). Só vale para afastamentos que têm
substituição. Em escala bloqueada, a resposta traz `NEEDS_CONFIRMATION`; para confirmar, `POST /substitutions/:id/apply`
com `applyToLockedSchedules: true` e `refreshFrom`/`refreshTo` (período antigo + novo).

Ao **criar ou alterar** a substituição, a linha do titular também é conferida no período: o afastamento pode ter sido
cadastrado depois de a escala ser gerada, e a grade precisa refletir isso.

## Métricas

A cobertura soma em "coberto" sem aumentar o "necessário": o plantão do titular já estava contado como necessário.

## Tabela e migração

`LeaveSubstitution` (migração `0019_leave_substitution`): afastamento, titular, substituto, rodízio
(`HABITUAL`/`SPECIFIC`), `specificParity`, `parityReferenceMonth`, `coveredDates`, situação e, no cancelamento,
quem/quando/motivo. Nada é excluído. Auditoria em `AuditLog` (`entity: LeaveSubstitution`).

## Limitações conhecidas

- A atualização das escalas é por mês, cada uma em sua transação; se uma falha, a substituição fica salva e a resposta
  indica o mês (`CONFLICT`/`FAILED`); `POST /substitutions/:id/apply` tenta de novo.
- Cadastrar um afastamento **sem** substituição continua não alterando escalas já geradas (comportamento anterior).
- Quem tem `substitutions:manage` consegue, por esta rota, atualizar a escala mesmo sem `schedules:edit` (a mudança é
  consequência da substituição, não uma edição de célula). Se o negócio quiser exigir os dois, é só conferir os dois
  em `substitution-routes.ts`.
- Não há ainda uma visão por mês das substituições na tela de Escalas; as coberturas aparecem como `C` na grade e os
  alertas, na lista de pendências.

## Testes

- `substitution-schedule.test.ts` — planejador e geração (habitual, parcial, Par/Ímpar específico dividindo um titular
  comercial, conflitos, prioridade, ajuste manual, dois meses com virada de Par/Ímpar, revalidação igual à geração).
- `substitution.integration.test.ts` — API real + Postgres: permissões, plano e `dryRun`, recusas, atualização do
  rascunho, idempotência, escala em análise/publicada, dois meses, cancelamento, mudança de datas, cancelamento das
  férias, convivência com a edição manual.
- `friendly-messages.test.ts` — tradução de todos os códigos novos.
