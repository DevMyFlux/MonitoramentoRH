# Edição de escalas já geradas

Depois de gerada, a escala do mês pode ser corrigida célula a célula (colaborador × dia). Quem pode: `schedules:edit`
(RH, Administrador e Desenvolvedor por padrão). O Aprovador e o perfil Comum só consultam.

## Endpoint

`PATCH /api/v1/employee-schedules/:id/cells`

```json
{
  "expectedRevision": 3,
  "changes": [{ "employeeId": "…", "date": "2026-10-02", "code": "C", "reason": "Cobrir falta" }],
  "justification": "Cobrir falta",
  "dryRun": false
}
```

| Campo | Significado |
| --- | --- |
| `expectedRevision` | Revisão da escala que a pessoa estava vendo. Se mudou, a API recusa (`SCHEDULE_REVISION_CONFLICT`). |
| `changes` | Uma ou mais células. O mesmo colaborador/dia não pode aparecer duas vezes. |
| `reason` / `justification` | Motivo por célula / para o conjunto. Obrigatório quando o código foge do que o rodízio manda. |
| `dryRun` | Só valida e mostra o efeito (avisos, métricas, código previsto pela regra); não grava nada. |

A resposta traz `changed`, `derived` (nasceu uma nova versão), `versionId`, `revision`, `issues` (avisos, já em
linguagem simples), `cells` (o que está na grade e o que a regra colocaria ali) e `metrics`.

## Onde a edição é gravada

| Situação da escala | O que acontece ao editar |
| --- | --- |
| Rascunho ou Reprovada | Edita na **própria versão** (revisão +1, hash do conteúdo atualizado). Reprovada continua reprovada até ser reenviada. |
| Em análise | Nasce uma **nova versão em rascunho**; a versão em análise fica **substituída** e não pode mais ser aprovada. |
| Aprovada | Idem: a aprovação **não vale** para a versão nova, que precisa ser enviada e aprovada de novo. |
| Publicada | Nasce uma nova versão em rascunho; a publicada **continua no ar** até a nova ser aprovada e publicada. |
| Substituída / excluída | Não se edita (`SCHEDULE_SUPERSEDED` / 404). |

Nada é apagado: a nova versão guarda `basedOnVersionId` (de qual partiu) e o histórico registra `EDIT`,
`SUPERSEDED` ou `NEW_VERSION_DRAFTED`.

## O que é validado (antes de gravar)

Impeditivo (a edição é recusada com 409 `SCHEDULE_EDIT_INVALID` e **nada é gravado**):

- código desconhecido, colaborador que não está na escala, data fora do mês, mesma célula duas vezes;
- afastamento/férias não se lançam à mão (vêm do cadastro de afastamentos) — `EDIT_LEAVE_CODE_NOT_ALLOWED`;
- trabalhar durante um afastamento ou antes da admissão / depois do desligamento;
- turno normal (D, N, M, T) em dia de folga pelo rodízio — o dia extra deve ser **Cobertura (C)**;
- falta de justificativa quando o código foge do rodízio.

Aviso (a edição é gravada e o aviso volta na resposta): colaborador sem aptidão (documento/competência),
descanso menor que o previsto no turno, cobertura que cai abaixo do necessário.

Reaproveita as regras da geração (`schedule-context.ts` — uma só implementação para gerar e validar). Existe um teste
que garante que recalcular as pendências de uma grade não editada dá exatamente o resultado da geração.

## Ajustes manuais do mês

Cada edição também grava um `ScheduleDayOverride` (unidade/colaborador/dia), que continua valendo nas próximas
gerações do mês. Editar uma célula **de volta ao que a regra manda** arquiva o ajuste (a célula volta a seguir a
regra). Processar a mesma edição duas vezes não muda nada (idempotente).

## Concorrência e auditoria

- gravação em transação `Serializable`, com `revision` otimista: duas edições simultâneas — só uma vale;
- `ScheduleHistory` guarda quem, quando, antes/depois (célula, de → para, motivo) e a justificativa;
- `AuditLog` guarda um resumo enxuto (sem a grade inteira).

## Limitações conhecidas

- Mudar dados **depois** da edição (ex.: cadastrar um afastamento novo) não revalida sozinho a escala já gerada;
  gere de novo ou edite a célula afetada.
- Escalas geradas antes desta funcionalidade, sem a grade guardada, não são editáveis (`SCHEDULE_NOT_EDITABLE`).
- O endpoint antigo `POST /schedule-day-overrides` continua existindo, mas só grava o ajuste para a próxima geração;
  a tela usa o `PATCH` acima.
