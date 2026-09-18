export type AptitudeColor = "GREEN" | "YELLOW" | "RED";

export type AptitudeReason = {
  code: string;
  message: string;
  severity: AptitudeColor;
  entityType: "DOCUMENT" | "COMPETENCY" | "SYSTEM";
  entityCode?: string;
};

export type DocumentRequirementInput = {
  code: string;
  name: string;
  warningDays: number;
  required: boolean;
  documents: Array<{
    expiresAt: Date | null;
    status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  }>;
};

export type CompetencyRequirementInput = {
  competencyCode: string;
  competencyName: string;
  requiredLevel: number;
  warningDays: number;
  required: boolean;
  competencies: Array<{
    level: number;
    expiresAt: Date | null;
    status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  }>;
};

export type AptitudeInput = {
  documentRequirements: DocumentRequirementInput[];
  competencyRequirements: CompetencyRequirementInput[];
  today?: Date;
};

export type AptitudeResult = {
  status: AptitudeColor;
  reasonCodes: string[];
  reasons: AptitudeReason[];
};

const rank: Record<AptitudeColor, number> = {
  GREEN: 1,
  YELLOW: 2,
  RED: 3
};

export function calculateAptitude(input: AptitudeInput): AptitudeResult {
  const today = startOfDay(input.today ?? new Date());
  const reasons = [
    ...input.documentRequirements.flatMap((requirement) =>
      evaluateDocumentRequirement(requirement, today)
    ),
    ...input.competencyRequirements.flatMap((requirement) =>
      evaluateCompetencyRequirement(requirement, today)
    )
  ];

  if (input.documentRequirements.length === 0 && input.competencyRequirements.length === 0) {
    reasons.push({
      code: "NO_APPLICABLE_REQUIREMENTS",
      message: "Nenhum requisito documental ou de competencia aplicavel ao colaborador.",
      severity: "GREEN",
      entityType: "SYSTEM"
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      code: "REQUIREMENTS_SATISFIED",
      message: "Todos os requisitos aplicaveis estao atendidos.",
      severity: "GREEN",
      entityType: "SYSTEM"
    });
  }

  const status = reasons.reduce<AptitudeColor>(
    (current, reason) => (rank[reason.severity] > rank[current] ? reason.severity : current),
    "GREEN"
  );

  return {
    status,
    reasonCodes: reasons.map((reason) => reason.code),
    reasons
  };
}

function evaluateDocumentRequirement(
  requirement: DocumentRequirementInput,
  today: Date
): AptitudeReason[] {
  if (!requirement.required) {
    return [];
  }

  const activeDocuments = requirement.documents.filter((document) => document.status === "ACTIVE");
  const validDocument = activeDocuments
    .filter((document) => !isExpired(document.expiresAt, today))
    .sort((left, right) => compareDatesDesc(left.expiresAt, right.expiresAt))[0];

  if (!validDocument) {
    return [
      {
        code: activeDocuments.length > 0 ? "DOCUMENT_EXPIRED" : "DOCUMENT_MISSING",
        message: `${requirement.name} ausente ou vencido.`,
        severity: "RED",
        entityType: "DOCUMENT",
        entityCode: requirement.code
      }
    ];
  }

  if (isExpiring(validDocument.expiresAt, today, requirement.warningDays)) {
    return [
      {
        code: "DOCUMENT_EXPIRING",
        message: `${requirement.name} vence dentro do periodo de alerta.`,
        severity: "YELLOW",
        entityType: "DOCUMENT",
        entityCode: requirement.code
      }
    ];
  }

  return [];
}

function evaluateCompetencyRequirement(
  requirement: CompetencyRequirementInput,
  today: Date
): AptitudeReason[] {
  if (!requirement.required) {
    return [];
  }

  const activeCompetencies = requirement.competencies.filter(
    (competency) => competency.status === "ACTIVE"
  );
  const matchingCompetency = activeCompetencies
    .filter((competency) => competency.level >= requirement.requiredLevel)
    .filter((competency) => !isExpired(competency.expiresAt, today))
    .sort((left, right) => compareDatesDesc(left.expiresAt, right.expiresAt))[0];

  if (!matchingCompetency) {
    const hasLowLevel = activeCompetencies.some(
      (competency) => competency.level < requirement.requiredLevel
    );
    return [
      {
        code: hasLowLevel ? "COMPETENCY_LEVEL_LOW" : "COMPETENCY_MISSING",
        message: `${requirement.competencyName} ausente, insuficiente ou vencida.`,
        severity: "RED",
        entityType: "COMPETENCY",
        entityCode: requirement.competencyCode
      }
    ];
  }

  if (isExpiring(matchingCompetency.expiresAt, today, requirement.warningDays)) {
    return [
      {
        code: "COMPETENCY_EXPIRING",
        message: `${requirement.competencyName} vence dentro do periodo de alerta.`,
        severity: "YELLOW",
        entityType: "COMPETENCY",
        entityCode: requirement.competencyCode
      }
    ];
  }

  return [];
}

function isExpired(date: Date | null, today: Date): boolean {
  return date !== null && startOfDay(date) < today;
}

function isExpiring(date: Date | null, today: Date, warningDays: number): boolean {
  if (date === null) {
    return false;
  }

  const warningLimit = new Date(today);
  warningLimit.setDate(warningLimit.getDate() + warningDays);

  return startOfDay(date) <= warningLimit;
}

function compareDatesDesc(left: Date | null, right: Date | null): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }

  return right.getTime() - left.getTime();
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
