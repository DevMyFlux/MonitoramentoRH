# Escalas Par/Ímpar — virada de mês

Regra de negócio: a classificação **Par/Ímpar** inverte (ou se mantém) na virada do mês conforme
o mês termina no dia 31 ou no dia 30, de modo que o rodízio de 1 dia de trabalho / 1 dia de folga
(12x36) nunca tenha dois dias seguidos de trabalho nem duas folgas seguidas.

## Como funcionava antes

`isParityWorkday(parity, date)` (em `employee-availability.ts`) olhava **só o dia do calendário**:
`ODD` trabalha nos dias ímpares, `EVEN` nos pares — em todos os meses, sempre igual.
Em mês de 31 dias, quem era Ímpar trabalhava dia 31 **e** dia 1º do mês seguinte (dois dias
seguidos); quem era Par folgava dia 31 **e** dia 1º (duas folgas seguidas). Não havia memória do mês
anterior, então a única forma de corrigir era alguém editar o cadastro (Par ↔ Ímpar) todo mês.

## Como funciona agora

| Mês que termina | Escala Ímpar | Escala Par | Classificação no mês seguinte |
|---|---|---|---|
| dia **31** | trabalha 31 → folga 1º → trabalha 2 | trabalha 30 → folga 31 → trabalha 1º | **inverte** (Ímpar vira Par e vice-versa) |
| dia **30** | trabalha 29 → folga 30 → trabalha 1º | trabalha 30 → folga 1º → trabalha 2 | **mantém** |

Implementação: `packages/shared/src/parity-rotation.ts` (módulo puro, usado pela API e pela web).

- `monthInvertsParity(ano, mês)` — única função que decide se um mês inverte (`true` só para 31 dias).
- `effectiveParity(cadastrada, mêsDeReferência, mêsAlvo)` — grupo que a pessoa segue no mês alvo:
  o cadastrado, invertido uma vez para cada mês de 31 dias entre a referência e o mês alvo
  (funciona para meses futuros **e** anteriores, e atravessa dezembro → janeiro).
- `isParityWorkday(cadastrada, 'AAAA-MM-DD', mêsDeReferência)` — usado por
  `employeeAvailability()` / `isScheduledDay()` na geração da escala.

Pontos que consomem a regra (todos pela mesma função):

- **Geração** (`employee-schedule-service.ts`): os dias vêm de `employeeAvailability()`; o rótulo
  da coluna "Escala" (`Diurno ímpar` / `Noturno par`) mostra a paridade **do mês gerado**.
- **Visualização**: a tela de Escalas exibe o que foi gerado (grade + rótulo).
- **Exportação da escala** (`xlsx-renderer.ts`): renderiza a grade/rótulo gerados — HMB e HETRIN
  usam o mesmo cálculo; os modelos de planilha, turnos e logotipos não mudaram.
- **Colaboradores** (lista e "Extrair XLSX"): a coluna "Rodízio" mostra o grupo que a pessoa
  segue no **mês atual** (fuso de São Paulo).
- Horário comercial/administrativo (sem rodízio, segunda a sexta) **não é afetado**.

## Decisão adicional: mês de referência (`Employee.parityReferenceMonth`)

O Par/Ímpar cadastrado só faz sentido **em relação a um mês**. Foi criada a coluna
`parityReferenceMonth` (texto `AAAA-MM`, migração `0013`) — "o mês em que este Par/Ímpar é
verdadeiro".

- Colaboradores já cadastrados (coluna nula) usam `DEFAULT_PARITY_REFERENCE_MONTH = 2026-10`:
  foi o mês das primeiras escalas conferidas. Setembro/2026 tem 30 dias, então setembro e outubro
  continuam **idênticos** ao comportamento anterior; a primeira diferença é **novembro/2026**
  (outubro tem 31 dias ⇒ inverte).
- Novo cadastro, ou troca do Par/Ímpar: o mês de referência passa a ser o **mês atual** (editável
  na aba "Unidade e escala", campo "Rodízio válido para o mês de"). Remover o rodízio limpa a referência.
- Escalas já geradas são fotos (`generatedResult`) e **não são recalculadas**. Só uma nova geração
  usa a regra nova; gerar de novo setembro/outubro de 2026 reproduz o resultado antigo.

## Fevereiro (não especificado) — decisão e pendência

A regra do negócio não define fevereiro. Foi mantido o comportamento que já existia: **fevereiro
nunca inverte** (`monthInvertsParity` devolve `false`).

- Fevereiro com **28 dias** (par): o ciclo contínuo não exige inversão — Par trabalha 28, folga 1º,
  trabalha 2; Ímpar trabalha 27, folga 28, trabalha 1º. Comportamento correto sem regra nova.
- Fevereiro com **29 dias** (bissexto, ex.: 2028): fica **como antes**, com quebra no ciclo —
  Ímpar trabalha dia 29 **e** dia 1º; Par folga 29 e 1º. **Pendente de decisão do negócio**
  (provável: tratar mês de 29 dias como o de 31, isto é, inverter; basta mudar
  `monthInvertsParity`). Há teste documentando o comportamento atual
  (`parity-rotation.test.ts`, "keeps the previous behaviour for a 29-day February").

## Testes

- `packages/shared/src/parity-rotation.test.ts` — os 4 exemplos da regra (31 e 30 dias), virada
  dez → jan, alternância estrita de 2025 a 2028 (para frente e para trás da referência), um e só um
  grupo por dia, fevereiro, referência padrão e meses de setembro/outubro inalterados.
- `apps/api/src/modules/scheduling/employee-schedule-rotation.test.ts` — geração real
  (`buildEmployeeScheduleSnapshot`) out/2026 → mar/2027 com banco simulado: alternância, rótulos,
  comerciais intactos, referência explícita, e exportação HMB/HETRIN pelo `renderScheduleWorkbook`.
- `apps/api/src/modules/employees/employee-export.test.ts` e `employee-parity-reference.test.ts` —
  rodízio do mês atual na planilha de colaboradores e atualização da referência no cadastro.
