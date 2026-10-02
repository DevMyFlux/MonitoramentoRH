export type Field = {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "select" | "checkbox" | "textarea" | "email" | "password";
  source?: string;
  options?: string[];
  optional?: boolean;
  value?: string | number | boolean;
};
export type Resource = {
  title: string;
  subtitle: string;
  endpoint: string;
  fields: Field[];
  columns: [string, string][];
  roles: string[];
  editable?: boolean;
};
const f = (key: string, label: string, source?: string): Field => ({
  key,
  label,
  ...(source ? { type: "select" as const, source } : {})
});
const op = f("operationId", "Operação", "/operations");
const emp = f("employeeId", "Colaborador", "/employees");
const fn = f("functionId", "Função", "/functions");
const named = [f("name", "Nome")];
const people = ["DEV", "ADMIN", "RH"];
const admin = ["DEV", "ADMIN"];
export const resources: Record<string, Resource> = {
  empresas: {
    title: "Empresas",
    subtitle: "Estruture a organização responsável pelas operações.",
    endpoint: "/companies",
    fields: named,
    columns: [
      ["name", "Empresa"],
      ["status", "Situação"]
    ],
    roles: ["DEV"],
    editable: true
  },
  clientes: {
    title: "Clientes",
    subtitle: "Clientes vinculados à empresa contratada.",
    endpoint: "/clients",
    fields: [f("companyId", "Empresa", "/companies"), ...named],
    columns: [
      ["name", "Cliente"],
      ["status", "Situação"]
    ],
    roles: admin,
    editable: true
  },
  unidades: {
    title: "Unidades",
    subtitle: "Locais onde os serviços são executados.",
    endpoint: "/units",
    fields: [
      f("companyId", "Empresa", "/companies"),
      f("clientId", "Cliente", "/clients"),
      ...named,
      f("code", "Código")
    ],
    columns: [
      ["name", "Unidade"],
      ["code", "Código"],
      ["status", "Situação"]
    ],
    roles: admin,
    editable: true
  },
  contratos: {
    title: "Contratos",
    subtitle: "Vínculos comerciais e vigências.",
    endpoint: "/contracts",
    fields: [
      f("companyId", "Empresa", "/companies"),
      f("clientId", "Cliente", "/clients"),
      ...named,
      f("code", "Código"),
      { key: "startsAt", label: "Início", type: "date" },
      { key: "endsAt", label: "Fim", type: "date", optional: true }
    ],
    columns: [
      ["name", "Contrato"],
      ["code", "Código"],
      ["startsAt", "Início"],
      ["endsAt", "Fim"]
    ],
    roles: admin,
    editable: true
  },
  operacoes: {
    title: "Operações",
    subtitle: "Empresa → cliente → contrato → unidade → operação.",
    endpoint: "/operations",
    fields: [
      f("companyId", "Empresa", "/companies"),
      f("clientId", "Cliente", "/clients"),
      f("contractId", "Contrato", "/contracts"),
      f("unitId", "Unidade", "/units"),
      ...named,
      f("code", "Código")
    ],
    columns: [
      ["name", "Operação"],
      ["code", "Código"],
      ["status", "Situação"]
    ],
    roles: admin,
    editable: true
  },
  servicos: {
    title: "Serviços",
    subtitle: "Serviços previstos para cada operação.",
    endpoint: "/services",
    fields: [op, ...named, f("code", "Código")],
    columns: [
      ["name", "Serviço"],
      ["code", "Código"]
    ],
    roles: admin,
    editable: true
  },
  obrigacoes: {
    title: "Obrigações",
    subtitle: "Compromissos operacionais dos serviços.",
    endpoint: "/obligations",
    fields: [
      op,
      f("serviceId", "Serviço", "/services"),
      f("title", "Título"),
      { key: "description", label: "Descrição", type: "textarea", optional: true }
    ],
    columns: [
      ["title", "Obrigação"],
      ["description", "Descrição"]
    ],
    roles: admin,
    editable: true
  },
  funcoes: {
    title: "Funções",
    subtitle: "Catálogo de funções por operação.",
    endpoint: "/functions",
    fields: [op, ...named, f("code", "Código")],
    columns: [
      ["name", "Função"],
      ["code", "Código"]
    ],
    roles: admin,
    editable: true
  },
  colaboradores: {
    title: "Colaboradores",
    subtitle: "Cadastro único e histórico funcional de cada pessoa.",
    endpoint: "/employees",
    fields: [
      op,
      fn,
      ...named,
      f("initials", "Iniciais"),
      { ...f("council", "Conselho (ex.: CREA, CRM)"), optional: true },
      f("identifier", "Matrícula"),
      f("jobTitle", "Cargo"),
      { key: "admissionDate", label: "Admissão", type: "date" },
      {
        key: "status",
        label: "Situação",
        type: "select",
        options: [
          "ACTIVE",
          "SCHEDULED_ADMISSION",
          "ON_LEAVE",
          "VACATION",
          "INACTIVE",
          "TERMINATED"
        ],
        value: "ACTIVE"
      },
      f("shift", "Código do turno"),
      {
        key: "parity",
        label: "Rodízio (ímpar/par)",
        type: "select",
        options: ["ODD", "EVEN"],
        optional: true
      },
      { ...f("team", "Equipe"), optional: true },
      { key: "notes", label: "Observações", type: "textarea", optional: true }
    ],
    columns: [
      ["name", "Colaborador"],
      ["initials", "Iniciais"],
      ["identifier", "Matrícula"],
      ["function", "Função"],
      ["shift", "Turno"],
      ["status", "Situação"]
    ],
    roles: people,
    editable: true
  },
  requisitos: {
    title: "Requisitos",
    subtitle: "Requisitos obrigatórios bloqueiam alocação quando ausentes ou vencidos.",
    endpoint: "/requirements",
    fields: [
      op,
      fn,
      {
        key: "kind",
        label: "Tipo",
        type: "select",
        options: ["DOCUMENT", "COMPETENCY"],
        value: "DOCUMENT"
      },
      f("code", "Código"),
      ...named,
      { key: "required", label: "Obrigatório / bloqueante", type: "checkbox", value: true },
      { key: "warningDays", label: "Antecedência de alerta (dias)", type: "number", value: 30 }
    ],
    columns: [
      ["name", "Requisito"],
      ["code", "Código"],
      ["kind", "Tipo"],
      ["required", "Obrigatório"]
    ],
    roles: people
  },
  documentos: {
    title: "Documentos",
    subtitle: "Registre comprovações e acompanhe suas validades.",
    endpoint: "/documents",
    fields: [
      emp,
      f("requirementId", "Requisito", "/requirements"),
      { key: "issuedAt", label: "Emissão", type: "date" },
      { key: "expiresAt", label: "Vencimento", type: "date", optional: true },
      { key: "notes", label: "Referência da comprovação / observações", type: "textarea" }
    ],
    columns: [
      ["employeeId", "Colaborador"],
      ["requirementId", "Requisito"],
      ["issuedAt", "Emissão"],
      ["expiresAt", "Validade"]
    ],
    roles: people
  },
  competencias: {
    title: "Competências",
    subtitle: "Capacidades e níveis demonstrados pelos colaboradores.",
    endpoint: "/employee-competencies",
    fields: [
      emp,
      f("competencyCode", "Código da competência"),
      f("competencyName", "Competência"),
      { key: "level", label: "Nível (1–5)", type: "number", value: 1 },
      { key: "achievedAt", label: "Avaliada em", type: "date" },
      { key: "expiresAt", label: "Validade", type: "date", optional: true }
    ],
    columns: [
      ["employeeId", "Colaborador"],
      ["competencyName", "Competência"],
      ["level", "Nível"],
      ["expiresAt", "Validade"]
    ],
    roles: people
  },
  matriz: {
    title: "Matriz de competências",
    subtitle: "Defina o nível mínimo exigido por função.",
    endpoint: "/competency-matrix",
    fields: [
      op,
      fn,
      f("competencyCode", "Código da competência"),
      f("competencyName", "Competência"),
      { key: "requiredLevel", label: "Nível mínimo (1–5)", type: "number", value: 1 },
      { key: "required", label: "Obrigatória", type: "checkbox", value: true }
    ],
    columns: [
      ["competencyName", "Competência"],
      ["functionId", "Função"],
      ["requiredLevel", "Nível exigido"]
    ],
    roles: people
  },
  criterios: {
    title: "Critérios de avaliação",
    subtitle: "Critérios e pesos parametrizáveis.",
    endpoint: "/evaluation-criteria",
    fields: [
      f("code", "Código"),
      ...named,
      { key: "weight", label: "Peso (1–10)", type: "number", value: 1 }
    ],
    columns: [
      ["name", "Critério"],
      ["weight", "Peso"]
    ],
    roles: people
  },
  eventos: {
    title: "Eventos e disponibilidade",
    subtitle: "Férias, afastamentos e treinamentos afetam a disponibilidade.",
    endpoint: "/calendar/events",
    fields: [
      op,
      emp,
      f("typeId", "Tipo de evento", "/event-types"),
      f("title", "Título"),
      { key: "startsAt", label: "Início", type: "date" },
      { key: "endsAt", label: "Fim (último dia)", type: "date" },
      { key: "notes", label: "Observações", type: "textarea", optional: true }
    ],
    columns: [
      ["title", "Evento"],
      ["employeeId", "Colaborador"],
      ["startsAt", "Início"],
      ["endsAt", "Fim"]
    ],
    roles: people,
    editable: true
  },
  tipos: {
    title: "Tipos de evento",
    subtitle: "Configure o efeito de cada evento na disponibilidade.",
    endpoint: "/event-types",
    fields: [
      f("code", "Código"),
      ...named,
      {
        key: "category",
        label: "Categoria",
        type: "select",
        options: ["VACATION", "LEAVE", "TRAINING", "ADMISSION", "TERMINATION", "TIME_OFF", "OTHER"]
      },
      {
        key: "blocksAvailability",
        label: "Bloqueia disponibilidade",
        type: "checkbox",
        value: true
      }
    ],
    columns: [
      ["name", "Tipo"],
      ["category", "Categoria"],
      ["blocksAvailability", "Bloqueia"]
    ],
    roles: admin
  },
  planos: {
    title: "Planos de desenvolvimento",
    subtitle: "Ações e prazos para o desenvolvimento das pessoas.",
    endpoint: "/development-plans",
    fields: [
      emp,
      f("title", "Título"),
      { key: "description", label: "Plano de ação", type: "textarea" },
      { key: "dueAt", label: "Prazo", type: "date" }
    ],
    columns: [
      ["title", "Plano"],
      ["employeeId", "Colaborador"],
      ["dueAt", "Prazo"],
      ["status", "Situação"]
    ],
    roles: people
  },
  qlp: {
    title: "QLP e posições",
    subtitle: "Versione o quadro de lotação e materialize posições após aprovação.",
    endpoint: "/qlp/versions",
    fields: [
      op,
      {
        key: "kind",
        label: "Tipo",
        type: "select",
        options: ["CONTRACTUAL", "OPERATIONAL"],
        value: "OPERATIONAL"
      },
      { key: "validFrom", label: "Vigência inicial", type: "date" },
      f("reason", "Motivo")
    ],
    columns: [
      ["version", "Versão"],
      ["kind", "Tipo"],
      ["status", "Situação"],
      ["validFrom", "Vigência"]
    ],
    roles: admin
  },
  recrutamento: {
    title: "Recrutamento e admissão",
    subtitle: "Conecte cada vaga a uma posição e acompanhe o candidato até a admissão.",
    endpoint: "/recruitment/requests",
    fields: [
      f("positionId", "Posição", "/positions"),
      f("reason", "Motivo"),
      { key: "desiredDate", label: "Data desejada", type: "date" }
    ],
    columns: [
      ["position", "Posição"],
      ["status", "Situação"],
      ["desiredDate", "Data desejada"]
    ],
    roles: people
  },
  escalas: {
    title: "Escalas",
    subtitle: "Gere uma escala mensal determinística e mantenha as lacunas visíveis.",
    endpoint: "/schedules",
    fields: [op, { key: "month", label: "Mês", type: "date" }],
    columns: [
      ["version", "Versão"],
      ["month", "Mês"],
      ["status", "Situação"]
    ],
    roles: admin
  },
  auditoria: {
    title: "Auditoria",
    subtitle: "Consulte mudanças críticas com usuário, entidade, justificativa e data.",
    endpoint: "/audit/logs",
    fields: [],
    columns: [
      ["action", "Ação"],
      ["entity", "Entidade"],
      ["entityId", "Registro"],
      ["createdAt", "Data"]
    ],
    roles: ["DEV", "ADMIN", "RH", "COMUM"],
    editable: false
  },
  importacoes: {
    title: "Importações",
    subtitle: "Faça staging, revise inconsistências e confirme somente após validação.",
    endpoint: "/imports",
    fields: [
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: ["EMPLOYEES", "QLP", "SCHEDULE"],
        value: "EMPLOYEES"
      },
      { key: "fileName", label: "Nome do arquivo" },
      { key: "contentBase64", label: "Conteúdo Base64", type: "textarea" },
      { key: "mapping", label: "Mapeamento JSON", type: "textarea", optional: true }
    ],
    columns: [
      ["fileName", "Arquivo"],
      ["type", "Tipo"],
      ["status", "Situação"],
      ["acceptedCount", "Aceitas"],
      ["rejectedCount", "Rejeitadas"]
    ],
    roles: people
  },
  parametros: {
    title: "Parâmetros operacionais",
    subtitle: "Configure turnos, jornadas, descanso e composição mínima.",
    endpoint: "/parameters",
    fields: [
      op,
      f("code", "Código do turno"),
      f("name", "Nome do turno"),
      { key: "configuration", label: "Configuração JSON", type: "textarea" }
    ],
    columns: [
      ["code", "Código"],
      ["name", "Turno"],
      ["revision", "Revisão"]
    ],
    roles: admin
  },
  usuarios: {
    title: "Usuários e perfis",
    subtitle: "Gerencie acesso com hierarquia e escopos restritos.",
    endpoint: "/users",
    fields: [
      f("name", "Nome"),
      { key: "email", label: "E-mail", type: "email" },
      {
        key: "role",
        label: "Perfil",
        type: "select",
        options: ["ADMIN", "RH", "COMUM"],
        value: "COMUM"
      },
      { key: "password", label: "Senha inicial", type: "password" }
    ],
    columns: [
      ["name", "Usuário"],
      ["email", "E-mail"],
      ["role", "Perfil"],
      ["isActive", "Ativo"]
    ],
    roles: people
  }
};
export const labels: Record<string, string> = {
  ODD: "Ímpar",
  EVEN: "Par",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SCHEDULED_ADMISSION: "Admissão programada",
  ON_LEAVE: "Afastado",
  VACATION: "Férias",
  TERMINATED: "Desligado",
  DRAFT: "Rascunho",
  IN_REVIEW: "Em aprovação",
  IN_RH_REVIEW: "Revisão do RH",
  APPROVED: "Aprovado",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
  REQUESTED: "Solicitado",
  RECRUITING: "Recrutamento",
  SELECTED: "Selecionado",
  DOCUMENTATION: "Documentação",
  MEDICAL_EXAM: "Exame médico",
  ADMISSION_SCHEDULED: "Admissão programada",
  ADMITTED: "Admitido",
  WITHDRAWN: "Desistência",
  CANCELLED: "Cancelado",
  FILLED: "Preenchida",
  VALIDATED: "Validado",
  COMMITTED: "Importado",
  REJECTED: "Rejeitado",
  GREEN: "Apto",
  YELLOW: "Com ressalvas",
  RED: "Impedido",
  CONTRACTUAL: "Contratual",
  OPERATIONAL: "Operacional"
};
