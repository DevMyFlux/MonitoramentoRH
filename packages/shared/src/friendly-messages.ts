/**
 * Camada única de tradução dos códigos técnicos para mensagens que uma pessoa de RH entende.
 *
 * Duas famílias, mantidas separadas de propósito (o mesmo código pode significar coisas
 * diferentes em cada uma — ex.: `FUTURE_ADMISSION` é pendência de escala e também erro de API):
 *
 *  - **Ocorrências** (`describeIssue`): pendências e validações da escala — por colaborador/data.
 *  - **Erros de API** (`describeApiError`): o que a API devolve quando uma operação falha.
 *
 * Regras:
 *  - O código técnico original nunca é alterado nem escondido: vai em `code` e em `technical`
 *    (para logs, suporte e monitoramento). A mensagem é só uma camada de apresentação.
 *  - Código sem tradução cai em uma mensagem genérica e segura; nunca se expõe stack trace,
 *    detalhe interno ou dado sensível.
 *  - `severity` diferencia o que IMPEDE o envio para aprovação (`blocking`) do que é alerta
 *    (`warning`) ou só informação (`info`). Só `blocking` barra o fluxo.
 */

export type IssueSeverity = "blocking" | "warning" | "info";

export const severityOrder: Record<IssueSeverity, number> = { blocking: 0, warning: 1, info: 2 };

export type IssueContext = {
  employeeName?: string | null;
  /** Data (AAAA-MM-DD) quando a ocorrência é de um único dia. */
  date?: string | null;
  /** Fim do período (AAAA-MM-DD) quando a ocorrência cobre um intervalo (usa `date` como início). */
  endDate?: string | null;
  /** Várias datas (AAAA-MM-DD) da mesma ocorrência, já agrupadas. */
  dates?: string[] | null;
  /** Outra pessoa envolvida (substituto, titular...). */
  otherName?: string | null;
  /** Textos já legíveis produzidos pelas regras de origem (ex.: "NR-10 ausente ou vencido."). */
  details?: string[] | null;
  /** Texto livre complementar (ex.: o motivo informado pelo usuário). */
  note?: string | null;
};

export type FriendlyIssue = {
  /** Código técnico original, preservado. */
  code: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  /** O que fazer para resolver; `null` quando não há ação a tomar. */
  action: string | null;
  /** Linha técnica para suporte/diagnóstico (nome · data · código). */
  technical: string;
  /** `false` quando o código não tem tradução específica (mensagem genérica). */
  known: boolean;
};

type IssueEntry = {
  severity: IssueSeverity;
  title: (c: IssueContext) => string;
  detail: (c: IssueContext) => string;
  action?: (c: IssueContext) => string;
};

export function formatBrDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/** "na data de 01/10/2026", "nas datas de 02/10, 04/10 e 06/10/2026", "em 15 dias, entre ... e ...". */
export function describeWhen(c: IssueContext): string {
  if (c.date && c.endDate && c.date !== c.endDate) {
    return `no período de ${formatBrDate(c.date)} a ${formatBrDate(c.endDate)}`;
  }
  const dates = [...new Set(c.dates?.length ? c.dates : c.date ? [c.date] : [])].sort();
  if (dates.length === 0) return "no período da escala";
  if (dates.length === 1) return `na data de ${formatBrDate(dates[0]!)}`;
  if (dates.length <= 3) {
    const year = dates[0]!.slice(0, 4);
    const sameYear = dates.every((d) => d.startsWith(year));
    const label = dates.map((d) => (sameYear ? formatBrDate(d).slice(0, 5) : formatBrDate(d)));
    return `nas datas de ${joinList(label)}${sameYear ? `/${year}` : ""}`;
  }
  return `em ${dates.length} dias, entre ${formatBrDate(dates[0]!)} e ${formatBrDate(dates.at(-1)!)}`;
}

const name = (c: IssueContext, fallback = "o colaborador") => c.employeeName?.trim() || fallback;
const nameDe = (c: IssueContext) => `de ${c.employeeName?.trim() || "um colaborador"}`;
const detailsText = (c: IssueContext, fallback: string) =>
  c.details?.filter(Boolean).join(" ") || fallback;

const issueCatalog = {
  // ── Pendências da geração da escala ───────────────────────────────────────
  SHIFT_NOT_CONFIGURED: {
    severity: "blocking",
    title: (c) => `Não foi possível definir o turno ${nameDe(c)}`,
    detail: (c) => `Não existe um turno configurado para esse colaborador ${describeWhen(c)}.`,
    action: () => "Verifique o cadastro e a configuração da escala antes de gerar novamente."
  },
  FUTURE_ADMISSION: {
    severity: "warning",
    title: (c) => `${name(c, "Um colaborador")} ainda não estava admitido`,
    detail: (c) =>
      `O rodízio previa trabalho ${describeWhen(c)}, mas a admissão é posterior. O dia ficou em branco e está sem cobertura.`,
    action: () => "Defina outra pessoa para cobrir o dia ou confira a data de admissão no cadastro."
  },
  EMPLOYEE_INACTIVE: {
    severity: "warning",
    title: (c) => `${name(c, "Um colaborador")} não está ativo`,
    detail: (c) =>
      `O cadastro não está ativo ${describeWhen(c)}, então o dia não pôde ser atribuído normalmente.`,
    action: () => "Reative o colaborador no cadastro ou ajuste o dia manualmente."
  },
  AFTER_TERMINATION: {
    severity: "info",
    title: (c) => `${name(c, "Um colaborador")} já estava desligado`,
    detail: (c) =>
      `O colaborador já estava desligado ${describeWhen(c)}; o dia fica em branco e não conta como cobertura necessária.`
  },
  OFF_ROTATION_DAY: {
    severity: "info",
    title: (c) => `Dia fora do rodízio ${nameDe(c)}`,
    detail: (c) =>
      `Pelo rodízio (par/ímpar ou dias da semana), o colaborador não trabalha ${describeWhen(c)}.`
  },
  BLOCKED_BY_EVENT: {
    severity: "warning",
    title: (c) => `Afastamento registrado ${nameDe(c)}`,
    detail: (c) =>
      `Há um afastamento (férias, atestado ou licença) que impede o trabalho ${describeWhen(c)}. ${detailsText(c, "")}`.trim(),
    action: () => "Confirme se esse período tem cobertura."
  },
  DOCUMENT_MISSING: {
    severity: "warning",
    title: (c) => `Documento obrigatório pendente ${nameDe(c)}`,
    detail: (c) =>
      `${detailsText(c, "Falta um documento obrigatório.")} Por isso o colaborador não pôde ser escalado ${describeWhen(c)}.`,
    action: () => "Atualize o documento no cadastro do colaborador."
  },
  DOCUMENT_EXPIRED: {
    severity: "warning",
    title: (c) => `Documento vencido ${nameDe(c)}`,
    detail: (c) =>
      `${detailsText(c, "Um documento obrigatório está vencido.")} Por isso o colaborador não pôde ser escalado ${describeWhen(c)}.`,
    action: () => "Renove o documento no cadastro do colaborador."
  },
  DOCUMENT_EXPIRING: {
    severity: "info",
    title: (c) => `Documento perto de vencer ${nameDe(c)}`,
    detail: (c) =>
      `${detailsText(c, "Um documento obrigatório vence em breve.")} O dia foi sinalizado ${describeWhen(c)}.`,
    action: () => "Providencie a renovação antes do vencimento."
  },
  COMPETENCY_MISSING: {
    severity: "warning",
    title: (c) => `Competência obrigatória pendente ${nameDe(c)}`,
    detail: (c) =>
      `${detailsText(c, "Falta uma competência obrigatória.")} Por isso o colaborador não pôde ser escalado ${describeWhen(c)}.`,
    action: () => "Registre a competência no cadastro do colaborador."
  },
  COMPETENCY_LEVEL_LOW: {
    severity: "warning",
    title: (c) => `Nível de competência insuficiente ${nameDe(c)}`,
    detail: (c) =>
      `${detailsText(c, "O nível de uma competência obrigatória está abaixo do exigido.")} Por isso o colaborador não pôde ser escalado ${describeWhen(c)}.`,
    action: () => "Atualize o nível da competência ou escale outra pessoa."
  },
  COMPETENCY_EXPIRING: {
    severity: "info",
    title: (c) => `Competência perto de vencer ${nameDe(c)}`,
    detail: (c) =>
      `${detailsText(c, "Uma competência obrigatória vence em breve.")} O dia foi sinalizado ${describeWhen(c)}.`,
    action: () => "Providencie a renovação antes do vencimento."
  },
  // ── Edição de escala já gerada ───────────────────────────────────────────
  EDIT_UNKNOWN_CODE: {
    severity: "blocking",
    title: (c) => `Código de escala inválido ${nameDe(c)}`,
    detail: (c) => `O código escolhido ${describeWhen(c)} não existe na legenda da escala.`,
    action: () => "Escolha um código da lista."
  },
  EDIT_EMPLOYEE_NOT_IN_SCHEDULE: {
    severity: "blocking",
    title: () => "Colaborador fora desta escala",
    detail: (c) =>
      `${name(c, "O colaborador")} não faz parte desta escala, então o dia não pode ser alterado.`,
    action: () => "Gere a escala novamente se a pessoa passou a fazer parte da unidade."
  },
  EDIT_DATE_OUTSIDE_MONTH: {
    severity: "blocking",
    title: () => "Data fora do mês da escala",
    detail: (c) => `A data ${describeWhen(c)} não pertence ao mês desta escala.`,
    action: () => "Escolha um dia do mês da escala."
  },
  EDIT_DUPLICATE_CHANGE: {
    severity: "blocking",
    title: () => "Alteração repetida",
    detail: (c) => `Há mais de uma alteração para ${name(c, "o colaborador")} ${describeWhen(c)}.`,
    action: () => "Mantenha uma única alteração por colaborador e dia."
  },
  EDIT_LEAVE_CODE_NOT_ALLOWED: {
    severity: "blocking",
    title: () => "Afastamento não pode ser lançado direto na escala",
    detail: (c) =>
      `Férias, licenças e atestados vêm do cadastro de afastamentos ${nameDe(c)}, e ${describeWhen(c)} não há esse afastamento registrado.`,
    action: () => "Registre o afastamento na ficha do colaborador e atualize a escala."
  },
  EDIT_EMPLOYEE_ON_LEAVE: {
    severity: "blocking",
    title: (c) => `${name(c, "O colaborador")} tem afastamento registrado`,
    detail: (c) =>
      `${detailsText(c, "Há um afastamento registrado")} (${describeWhen(c)}). O dia deve continuar como afastamento.`,
    action: () =>
      "Para cobrir o dia, escolha outro colaborador ou ajuste o afastamento no cadastro."
  },
  EDIT_EMPLOYEE_NOT_ACTIVE: {
    severity: "blocking",
    title: (c) => `${name(c, "O colaborador")} não está ativo nesse dia`,
    detail: (c) =>
      `Não é possível escalar ${describeWhen(c)}: a pessoa ainda não foi admitida, já foi desligada ou o cadastro não está ativo.`,
    action: () => "Escolha outro colaborador."
  },
  EDIT_WORK_ON_REST_DAY: {
    severity: "blocking",
    title: (c) => `Dia de folga ${nameDe(c)} pelo rodízio`,
    detail: (c) =>
      `Pelo rodízio o colaborador não trabalha ${describeWhen(c)}. Um turno normal não pode ser lançado em dia de folga.`,
    action: () => "Se for um dia extra de trabalho, use Cobertura (C)."
  },
  EDIT_JUSTIFICATION_REQUIRED: {
    severity: "blocking",
    title: (c) => `Informe o motivo do ajuste ${nameDe(c)}`,
    detail: (c) => `A alteração ${describeWhen(c)} foge do rodízio e precisa de uma justificativa.`,
    action: () => "Escreva o motivo; ele fica registrado no histórico da escala."
  },
  EDIT_APTITUDE_NOT_OK: {
    severity: "warning",
    title: (c) => `Pendência de documentos ou competências ${nameDe(c)}`,
    detail: (c) => `${detailsText(c, "O cadastro tem uma pendência.")} (${describeWhen(c)}).`,
    action: () => "Regularize o cadastro ou escolha outro colaborador."
  },
  EDIT_REST_TIME_SHORT: {
    severity: "warning",
    title: (c) => `Descanso menor que o previsto ${nameDe(c)}`,
    detail: (c) => detailsText(c, "O descanso entre os turnos é menor que o previsto."),
    action: () => "Confirme se esse dia extra é realmente necessário."
  },
  EDIT_COVERAGE_ON_WORKDAY: {
    severity: "warning",
    title: (c) => `Cobertura em dia que já é de trabalho ${nameDe(c)}`,
    detail: (c) =>
      `${name(c, "O colaborador")} já trabalha ${describeWhen(c)} pelo rodízio; a cobertura (C) não acrescenta pessoal nesse dia.`,
    action: () => "Use Cobertura (C) em um dia de folga do colaborador."
  },
  EDIT_COVERAGE_REDUCED: {
    severity: "info",
    title: (c) => `Dia de trabalho virou folga ${nameDe(c)}`,
    detail: (c) =>
      `${name(c, "O colaborador")} trabalharia ${describeWhen(c)} pelo rodízio; com a folga, a cobertura desse dia diminui.`
  },
  NO_APPLICABLE_REQUIREMENTS: {
    severity: "info",
    title: (c) => `Sem requisitos aplicáveis ${nameDe(c)}`,
    detail: () => "Nenhum requisito de documento ou competência se aplica a este colaborador."
  },
  REQUIREMENTS_SATISFIED: {
    severity: "info",
    title: (c) => `Requisitos atendidos ${nameDe(c)}`,
    detail: () => "Todos os requisitos aplicáveis estão atendidos."
  }
} satisfies Record<string, IssueEntry>;

export type KnownIssueCode = keyof typeof issueCatalog;

/** Registra uma família de ocorrências (usado pelos módulos que acrescentam códigos próprios). */
const extraCatalog: Record<string, IssueEntry> = {};
export function registerIssueEntries(entries: Record<string, IssueEntry>): void {
  Object.assign(extraCatalog, entries);
}

function lookupIssue(code: string): IssueEntry | undefined {
  return (issueCatalog as Record<string, IssueEntry>)[code] ?? extraCatalog[code];
}

export function isKnownIssueCode(code: string): boolean {
  return lookupIssue(code) !== undefined;
}

export function issueSeverity(code: string): IssueSeverity {
  return lookupIssue(code)?.severity ?? "warning";
}

function technicalLine(code: string, c: IssueContext): string {
  const when = c.date ?? c.dates?.[0] ?? "";
  return [c.employeeName, when, code].filter(Boolean).join(" · ");
}

export function describeIssue(code: string, context: IssueContext = {}): FriendlyIssue {
  const entry = lookupIssue(code);
  if (!entry) {
    return {
      code,
      severity: "warning",
      title: `Pendência na escala ${nameDe(context)}`,
      detail: `Foi encontrada uma pendência ${describeWhen(context)} que ainda não tem uma descrição específica.`,
      action: "Se ela continuar aparecendo, informe o código técnico ao suporte.",
      technical: technicalLine(code, context),
      known: false
    };
  }
  return {
    code,
    severity: entry.severity,
    title: entry.title(context),
    detail: entry.detail(context),
    action: entry.action ? entry.action(context) : null,
    technical: technicalLine(code, context),
    known: true
  };
}

// ── Pendências persistidas na escala ──────────────────────────────────────────

export type SchedulePendencyLike = {
  employeeId?: string;
  employeeName: string;
  date: string;
  reasonCodes: string[];
  details?: Array<{ code: string; message: string }>;
};

export type IssueGroup = FriendlyIssue & {
  employeeName: string | null;
  dates: string[];
  count: number;
};

/**
 * Agrupa as pendências por (colaborador, código) para não listar uma linha por dia: "Felipe — 12 dias".
 * A ordem é: impeditivas primeiro, depois alertas e informativas; dentro disso, por colaborador.
 */
export function groupPendencies(pendencies: SchedulePendencyLike[]): IssueGroup[] {
  const groups = new Map<
    string,
    { employeeName: string; code: string; dates: string[]; details: Set<string> }
  >();
  for (const p of pendencies) {
    for (const code of p.reasonCodes) {
      const key = `${p.employeeId ?? p.employeeName}|${code}`;
      const group = groups.get(key) ?? {
        employeeName: p.employeeName,
        code,
        dates: [],
        details: new Set<string>()
      };
      group.dates.push(p.date);
      for (const d of p.details ?? []) if (d.code === code) group.details.add(d.message);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((g) => {
      const dates = [...new Set(g.dates)].sort();
      const issue = describeIssue(g.code, {
        employeeName: g.employeeName,
        dates,
        details: [...g.details]
      });
      return { ...issue, employeeName: g.employeeName, dates, count: dates.length };
    })
    .sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        (a.employeeName ?? "").localeCompare(b.employeeName ?? "", "pt-BR") ||
        a.code.localeCompare(b.code)
    );
}

export function hasBlockingIssues(items: Array<{ severity: IssueSeverity }>): boolean {
  return items.some((i) => i.severity === "blocking");
}

// ── Erros de API ──────────────────────────────────────────────────────────────

export type ApiErrorInput = {
  code: string;
  /** Mensagem original da API (texto técnico/curto escrito pelo desenvolvedor). */
  message?: string;
  status?: number;
  details?: Record<string, unknown>;
};

export type FriendlyApiError = {
  code: string;
  message: string;
  action: string | null;
  known: boolean;
};

type ApiEntry = { message: string | ((original: string) => string); action?: string };

const notFoundAction = "Atualize a página; o registro pode ter sido removido.";
const sessionEntry: ApiEntry = {
  message: "Sua sessão expirou ou não é mais válida.",
  action: "Entre novamente."
};

const apiErrorCatalog: Record<string, ApiEntry> = {
  AUTHENTICATION_REQUIRED: {
    message: "É necessário entrar no sistema para continuar.",
    action: "Faça login novamente."
  },
  INVALID_ACCESS_TOKEN: sessionEntry,
  INVALID_REFRESH_TOKEN: sessionEntry,
  INVALID_CREDENTIALS: {
    message: "E-mail ou senha incorretos.",
    action: "Confira os dados e tente novamente."
  },
  INVALID_RESET_TOKEN: {
    message: "O link de redefinição de senha é inválido ou expirou.",
    action: "Solicite um novo link."
  },
  INVALID_INVITATION: {
    message: "O convite é inválido ou expirou.",
    action: "Peça um novo convite a um administrador."
  },
  RATE_LIMITED: {
    message: "Foram feitas muitas tentativas em pouco tempo.",
    action: "Aguarde um minuto e tente novamente."
  },
  FORBIDDEN: {
    message: "Você não tem permissão para realizar esta ação.",
    action: "Se precisar desse acesso, peça a um administrador."
  },
  SCOPE_FORBIDDEN: { message: "Este registro pertence a uma unidade fora do seu acesso." },
  SCOPE_ESCALATION: { message: "Você só pode conceder acesso às unidades que você mesmo possui." },
  ROLE_ELEVATION_FORBIDDEN: {
    message: "Você não pode criar ou alterar um perfil de nível igual ou superior ao seu."
  },
  DEV_GLOBAL_SCOPE_REQUIRED: {
    message: "Todo usuário administrador precisa ter acesso a todas as unidades."
  },
  LAST_DEV: {
    message: "Não é possível desativar o último administrador ativo.",
    action: "Cadastre outro administrador antes de desativar este."
  },
  NOT_FOUND: { message: "O registro não foi encontrado.", action: notFoundAction },
  OPERATION_NOT_FOUND: { message: "A unidade não foi encontrada.", action: notFoundAction },
  EMPLOYEE_NOT_FOUND: { message: "O colaborador não foi encontrado.", action: notFoundAction },
  SCHEDULE_NOT_FOUND: { message: "A escala não foi encontrada.", action: notFoundAction },
  EVENT_NOT_FOUND: {
    message: "O afastamento ou evento não foi encontrado.",
    action: notFoundAction
  },
  USER_NOT_FOUND: { message: "O usuário não foi encontrado.", action: notFoundAction },
  OVERRIDE_NOT_FOUND: { message: "O ajuste manual não foi encontrado.", action: notFoundAction },
  DOCUMENT_NOT_FOUND: { message: "O documento não foi encontrado.", action: notFoundAction },
  REQUIREMENT_NOT_FOUND: { message: "O requisito não foi encontrado.", action: notFoundAction },
  COMPETENCY_MATRIX_ITEM_NOT_FOUND: {
    message: "O item da matriz de competências não foi encontrado.",
    action: notFoundAction
  },
  EMPLOYEE_COMPETENCY_NOT_FOUND: {
    message: "A competência do colaborador não foi encontrada.",
    action: notFoundAction
  },
  QLP_VERSION_NOT_FOUND: { message: "A versão do QLP não foi encontrada.", action: notFoundAction },
  EVALUATION_NOT_FOUND: { message: "A avaliação não foi encontrada.", action: notFoundAction },
  IMPORT_NOT_FOUND: { message: "A importação não foi encontrada.", action: notFoundAction },
  CANDIDATE_NOT_FOUND: { message: "O candidato não foi encontrado.", action: notFoundAction },
  NO_EMPLOYEES: {
    message: "Não há colaboradores ativos nesta unidade para montar a escala.",
    action: "Cadastre ou reative colaboradores e gere a escala novamente."
  },
  NO_DUTIES: {
    message: "Nenhuma posição com jornada foi encontrada neste período.",
    action: "Confira o QLP e os turnos da unidade."
  },
  APPROVED_QLP_REQUIRED: {
    message: "É necessário um QLP operacional aprovado, com vigência para todo o mês.",
    action: "Aprove o QLP antes de gerar a escala."
  },
  SCHEDULE_RULES_REQUIRED: {
    message: "Os turnos e jornadas da unidade ainda não foram cadastrados.",
    action: "Cadastre-os em Parâmetros antes de gerar a escala."
  },
  SHIFT_NOT_CONFIGURED: {
    message: (original) => original || "Há um turno que não está configurado.",
    action: "Cadastre o turno em Parâmetros ou corrija o cadastro do colaborador."
  },
  SCHEDULE_NOT_EXPORTABLE: {
    message: "Esta versão da escala não pode ser exportada.",
    action: "Gere uma nova escala pela tela de Escalas e exporte a nova versão."
  },
  UNIT_TEMPLATE_NOT_CONFIGURED: {
    message: (original) => original || "A unidade não tem um modelo de planilha configurado.",
    action: "Peça a um administrador para configurar o modelo da unidade."
  },
  UNKNOWN_SCHEDULE_CODE: {
    message: "O código de escala informado não existe.",
    action: "Escolha um código da lista."
  },
  SCHEDULE_WORKFLOW_FORBIDDEN: {
    message: "Esta mudança de situação da escala não é permitida.",
    action: "Confira se a escala está na etapa correta e se o seu perfil tem essa permissão."
  },
  QLP_WORKFLOW_FORBIDDEN: {
    message: "Esta mudança de situação do QLP não é permitida.",
    action: "Confira a etapa atual e o seu perfil."
  },
  EVALUATION_WORKFLOW_FORBIDDEN: {
    message: "Esta mudança de situação da avaliação não é permitida.",
    action: "Confira a etapa atual e o seu perfil."
  },
  PARITY_REQUIRED: {
    message: (original) => original || "Informe o rodízio (par ou ímpar) do colaborador.",
    action: "Complete o campo de rodízio na aba Unidade e escala."
  },
  SERVER_SNAPSHOT_REQUIRED: {
    message: "Para gerar a escala, informe a unidade e o mês.",
    action: "Use a tela de Escalas."
  },
  PERMISSION_DENIED: {
    message: (original) => original || "Seu perfil não tem permissão para esta ação.",
    action: "Se precisar desse acesso, peça a um administrador."
  },
  PERMISSION_CHANGE_FORBIDDEN: {
    message: (original) => original || "Esta alteração de permissões não é permitida.",
    action: "Você só pode alterar perfis abaixo do seu e conceder o que você mesmo possui."
  },
  ROLE_NOT_FOUND: { message: "O perfil não foi encontrado.", action: notFoundAction },
  ACCOUNT_LOCKED: {
    message:
      "Sua conta está bloqueada temporariamente por tentativas de acesso seguidas sem sucesso.",
    action: "Aguarde alguns minutos ou peça a um administrador para desbloquear."
  },
  ACCOUNT_DISABLED: {
    message: "Sua conta está desativada.",
    action: "Procure um administrador para reativar o seu acesso."
  },
  CANNOT_CHANGE_OWN_ROLE: {
    message: "Você não pode alterar o próprio perfil.",
    action: "Peça a outro administrador."
  },
  CANNOT_DISABLE_SELF: {
    message: "Você não pode desativar a própria conta.",
    action: "Peça a outro administrador."
  },
  SCHEDULE_HAS_BLOCKING_ISSUES: {
    message: (original) => original || "A escala tem problemas que impedem o envio.",
    action:
      "Corrija os itens indicados (cadastro e configuração) e gere ou envie a escala novamente."
  },
  SCHEDULE_SUPERSEDED: {
    message: (original) => original || "Esta versão foi substituída por uma mais recente.",
    action: "Atualize a página e trabalhe na versão mais recente."
  },
  SCHEDULE_REVISION_CONFLICT: {
    message: (original) => original || "Esta escala foi alterada por outra pessoa.",
    action: "Atualize a página, confira o que mudou e tente de novo."
  },
  APPROVAL_STALE: {
    message: (original) => original || "A aprovação não vale mais para o conteúdo atual da escala.",
    action: "A escala precisa ser reenviada para uma nova análise."
  },
  REJECTION_REASON_REQUIRED: {
    message: "Para reprovar uma escala é obrigatório informar o motivo.",
    action: "Explique o que precisa ser corrigido (mínimo de 5 caracteres)."
  },
  SCHEDULE_EDIT_INVALID: {
    message: (original) => original || "A alteração não pôde ser aplicada.",
    action: "Corrija os itens indicados e tente de novo; nada foi alterado na escala."
  },
  SCHEDULE_NOT_EDITABLE: {
    message: "Esta versão da escala foi gerada por um fluxo anterior e não pode ser editada.",
    action: "Gere uma nova escala pela tela de Escalas."
  },
  DATA_CONFLICT: {
    message: "Os dados foram alterados por outra pessoa ou existe um vínculo com outro registro.",
    action: "Recarregue a página e confira o registro antes de tentar de novo."
  },
  VALIDATION_ERROR: {
    message: "Alguns dados enviados estão incompletos ou inválidos.",
    action: "Revise os campos indicados e tente novamente."
  },
  INTERNAL_SERVER_ERROR: {
    message: "Ocorreu um erro inesperado.",
    action: "Tente novamente em instantes. Se continuar, informe o código de referência ao suporte."
  },
  REQUEST_ERROR: {
    message: "Não foi possível processar a solicitação.",
    action: "Revise os dados e tente novamente."
  }
};

/** Registra códigos de API próprios de um módulo (mesma regra do catálogo principal). */
export function registerApiErrorEntries(entries: Record<string, ApiEntry>): void {
  Object.assign(apiErrorCatalog, entries);
}

const GENERIC_ERROR = {
  message: "Não foi possível concluir a operação.",
  action: "Tente novamente. Se o problema continuar, informe o código técnico ao suporte."
};

export function describeApiError(input: ApiErrorInput): FriendlyApiError {
  const original = (input.message ?? "").trim();
  const entry = apiErrorCatalog[input.code];
  if (entry) {
    return {
      code: input.code,
      message: typeof entry.message === "function" ? entry.message(original) : entry.message,
      action: entry.action ?? null,
      known: true
    };
  }
  // Sem tradução: erros 4xx trazem uma frase escrita pela aplicação (segura para exibir);
  // 5xx ou sem texto caem na mensagem genérica — nada interno vaza.
  const status = input.status ?? 500;
  if (status < 500 && original) {
    return { code: input.code, message: original, action: null, known: false };
  }
  return { code: input.code, ...GENERIC_ERROR, known: false };
}

// ── Erros de validação de campos (Zod) ────────────────────────────────────────

const fieldLabels: Record<string, string> = {
  email: "E-mail",
  password: "Senha",
  name: "Nome",
  month: "Mês",
  operationId: "Unidade",
  employeeId: "Colaborador",
  date: "Data",
  code: "Código",
  reason: "Motivo",
  status: "Situação",
  startsAt: "Início",
  endsAt: "Fim",
  title: "Título",
  typeId: "Tipo",
  justification: "Justificativa",
  overrideJustification: "Justificativa",
  role: "Perfil"
};

export type ZodIssueLike = {
  code?: string;
  path: ReadonlyArray<string | number | symbol>;
  message?: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  format?: string;
  input?: unknown;
};

export type FriendlyField = { path: string; label: string; message: string };

export function friendlyFieldIssue(issue: ZodIssueLike): FriendlyField {
  const path = issue.path.map(String).join(".");
  const last = String(issue.path.at(-1) ?? "");
  const label = fieldLabels[last] ?? (path || "Dados enviados");
  let message = "valor inválido";
  switch (issue.code) {
    case "invalid_type":
      message = issue.input === undefined ? "campo obrigatório" : "tipo de valor inválido";
      break;
    case "too_small":
      message =
        issue.origin === "string"
          ? Number(issue.minimum) <= 1
            ? "campo obrigatório"
            : `precisa ter pelo menos ${issue.minimum} caracteres`
          : issue.origin === "array"
            ? `selecione pelo menos ${issue.minimum} item(ns)`
            : `valor menor que o permitido (${issue.minimum})`;
      break;
    case "too_big":
      message =
        issue.origin === "string"
          ? `passou do limite de ${issue.maximum} caracteres`
          : `valor maior que o permitido (${issue.maximum})`;
      break;
    case "invalid_format":
      message =
        issue.format === "email"
          ? "e-mail inválido"
          : issue.format === "uuid"
            ? "identificador inválido"
            : issue.format === "date"
              ? "data inválida (use AAAA-MM-DD)"
              : "formato inválido";
      break;
    case "invalid_value":
      message = "opção não permitida";
      break;
    default:
      message =
        issue.message && /[áéíóúãõçâêô]/i.test(issue.message) ? issue.message : "valor inválido";
  }
  return { path, label, message };
}

export function summarizeFieldIssues(fields: FriendlyField[]): string {
  return fields.map((f) => `${f.label}: ${f.message}`).join("; ");
}
