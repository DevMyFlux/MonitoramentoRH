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

## Escala comercial 5x2 (segunda a sexta)

Além do 12x36 (Par/Ímpar), a pessoa pode ser cadastrada na **escala comercial 5x2**: trabalha de
segunda a sexta, sábado e domingo são folga, e **não tem Par/Ímpar** (portanto a regra de virada de
mês não se aplica a ela).

- **Como o sistema distingue** (`packages/shared/src/shift-pattern.ts`): pela configuração do próprio
  turno da unidade (`OperationalParameter.configuration.weekdays`). Turno que lista os 7 dias
  (Diurno/Noturno) é 12x36; turno que lista só dias úteis, sem sábado/domingo (Comercial,
  Administrativo — e qualquer outro que a unidade cadastrar) é 5x2. Nenhum código de turno fica fixo
  no código-fonte.
- **Cadastro** (Colaboradores → aba "Unidade e escala"): campo "Tipo de escala" — *12x36 — Par/Ímpar*
  (pede Turno + Rodízio) ou *Comercial 5x2* (pede só o horário comercial da unidade, ex.:
  HMB "Comercial · 08:00–17:00"; HETRIN "Comercial" e "Administrativo"). O Par/Ímpar some e é limpo.
  Quem entra na escala (Ativo / Admissão programada) precisa ter o tipo, o turno e — no 12x36 — o rodízio.
- **API** (`resolveRotation` em `employee-repository.ts`): turno 5x2 ⇒ `parity` e
  `parityReferenceMonth` são zerados mesmo que venham preenchidos; turno 12x36 sem rodízio para
  quem entra na escala ⇒ erro `PARITY_REQUIRED` (sem isso a pessoa seria escalada todos os dias).
- **Escala**: a geração já usava os dias da semana do turno quando não há rodízio; a pessoa aparece
  no grupo DIURNO (ou NOTURNO, conforme o início do turno), com o horário do turno, `D` de segunda a
  sexta e `F` no fim de semana, e conta só os dias úteis na cobertura. Na lista de colaboradores a
  coluna Rodízio mostra "5x2"; na planilha de colaboradores, a escala sai como "Comercial (5x2)".
- **Feriados:** ver a seção "Feriados" abaixo (a pendência anterior sobre feriados foi resolvida
  quanto à pintura; quanto ao que o 5x2 faz no feriado, continua sem regra — o dia segue `D`).

## Feriados (pintados como na planilha de referência)

- **Padrão da planilha:** lido nos arquivos de referência de outubro/2026. No **HMB**, a coluna do
  feriado (12/10, segunda) é pintada com o mesmo azul `B4C6E7` dos fins de semana — cabeçalho do dia e
  todas as linhas de colaboradores. No **HETRIN** a planilha de referência não pinta fim de semana nem
  feriado (cada código já tem seu preenchimento), então nada extra é pintado.
  Por isso a cor vem do `weekendTint` do modelo (`null` no HETRIN). O cabeçalho dos dias de fim de semana
  do HMB também passou a ser azul, como na referência.
- **Calendário** (`packages/shared/src/holidays.ts`): só feriados legais — Confraternização Universal,
  Sexta-feira Santa (móvel), Tiradentes, Dia do Trabalho, Independência, N. Sra. Aparecida, Finados,
  Proclamação da República, Consciência Negra e Natal; HMB (cidade de São Paulo) soma o aniversário da
  cidade (25/01) e o 9 de Julho. **Ponto facultativo** (Carnaval, Corpus Christi) não entra. Datas
  estaduais/municipais do HETRIN (Trindade/GO) não foram informadas: hoje só os feriados nacionais — basta
  incluí-las em `unitHolidays`.
- **Onde aparece:** a geração grava `grid.holidays`; a tela de Escalas pinta o cabeçalho e a coluna do dia
  e mostra "Feriado: 12/10 Nossa Senhora Aparecida" na legenda; a exportação usa o mesmo dado. Versões
  geradas antes deste recurso não têm a lista — são pintadas a partir do calendário (que é fixo), então
  também saem marcadas.
- Feriado **só marca o dia**: não muda quem trabalha (rodízio e 5x2 seguem iguais).

## Desligamento programado (`Employee.terminationDate`, migração 0014)

- Campo "Desligamento programado (último dia de trabalho)" na aba Status. **Até essa data inclusive** a
  pessoa aparece normalmente na escala; **depois dela os dias ficam em branco**, sem pendência e sem
  contar na cobertura necessária.
- A pessoa continua `Ativo` até alguém marcar `Desligado`; a lista mostra "Desliga em dd/mm/aaaa" (e avisa
  quando a data já passou). Em mês em que a data é anterior ao primeiro dia, a pessoa nem entra na grade.
- Um `Desligado` **com data** continua aparecendo até a data (inclusive no mês em que saiu), sem alertar
  "colaborador inativo". `Desligado` sem data (cadastros antigos) segue fora da escala como antes.
- Botão **Desligar** sem data grava hoje (ou hoje no lugar de uma data futura planejada); **Reativar** limpa a
  data. A planilha de Colaboradores ganhou a coluna "Desligamento programado".
- Ajuste manual de um dia continua valendo sobre o desligamento (o override é aplicado antes).
