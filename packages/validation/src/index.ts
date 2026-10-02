import { z } from "zod";

export const roleSchema = z.enum(["DEV", "ADMIN", "RH", "COMUM"]);

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional()
});

export const healthStatusSchema = z.object({
  service: z.literal("my-flux-api"),
  status: z.literal("ok"),
  version: z.string().min(1)
});

export const emailSchema = z.string().email().max(255).toLowerCase();

export const passwordSchema = z.string().min(12).max(256);

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema
});

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema
});

export const acceptInvitationRequestSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema
});

export const scopeInputSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  operationId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  isGlobal: z.boolean().default(false)
});

export const createUserRequestSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).max(160),
  role: roleSchema,
  password: passwordSchema,
  scopes: z.array(scopeInputSchema).default([])
});

export const invitationRequestSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).max(160),
  role: roleSchema,
  scopes: z.array(scopeInputSchema).default([])
});

export const idParamsSchema = z.object({
  id: z.string().uuid()
});

/**
 * Manual, per-employee, per-day correction applied on top of the automatically
 * generated schedule — used from Fase 6 onward. `code` is only shape-checked
 * here; the API validates it against the shared schedule codes catalog
 * (packages/shared/schedule-codes), since that package cannot currently be
 * imported from packages/validation (see tsconfig rootDir note in shared).
 */
export const scheduleDayOverrideInputSchema = z.object({
  operationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.string().date(),
  code: z.string().min(1).max(10),
  reason: z.string().max(500).nullable().optional()
});

export const companyInputSchema = z.object({
  name: z.string().min(2).max(180),
  document: z.string().max(40).nullable().optional()
});

export const clientInputSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2).max(180),
  document: z.string().max(40).nullable().optional()
});

export const unitInputSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(180),
  code: z.string().max(40).nullable().optional()
});

export const contractInputSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid(),
  name: z.string().min(2).max(180),
  code: z.string().max(40).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional()
});

export const operationInputSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid(),
  contractId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid(),
  name: z.string().min(2).max(180),
  code: z.string().max(40).nullable().optional()
});

export const serviceInputSchema = z.object({
  operationId: z.string().uuid(),
  name: z.string().min(2).max(180),
  code: z.string().max(40).nullable().optional()
});

export const obligationInputSchema = z.object({
  operationId: z.string().uuid(),
  serviceId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(180),
  description: z.string().max(2000).nullable().optional()
});

export const jobFunctionInputSchema = z.object({
  operationId: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(180),
  code: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional()
});

export const importTypeSchema = z.enum(["EMPLOYEES", "QLP", "SCHEDULE"]);

export const importPreviewRequestSchema = z.object({
  type: importTypeSchema,
  fileName: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  mapping: z.record(z.string(), z.string()).default({})
});

export const employeeStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "ON_LEAVE",
  "VACATION",
  "TERMINATED",
  "SCHEDULED_ADMISSION"
]);

export const employeeParitySchema = z.enum(["ODD", "EVEN"]);

export const employeeInputSchema = z.object({
  operationId: z.string().uuid(),
  functionId: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(180),
  identifier: z.string().min(1).max(80),
  initials: z.string().min(1).max(12),
  /** Professional council registration (e.g. CREA/CRM), when the role requires one. */
  council: z.string().max(80).nullable().optional(),
  employmentType: z.string().max(80).nullable().optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  admissionDate: z.string().datetime().nullable().optional(),
  status: employeeStatusSchema.default("ACTIVE"),
  workRegime: z.string().max(80).nullable().optional(),
  shift: z.string().max(80).nullable().optional(),
  /** Odd/even calendar-day rotation group. Leave empty for fixed weekday schedules. */
  parity: employeeParitySchema.nullable().optional(),
  team: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const qlpKindSchema = z.enum(["CONTRACTUAL", "OPERATIONAL"]);

export const qlpRequirementInputSchema = z.object({
  functionId: z.string().uuid(),
  workRegime: z.string().max(80).nullable().optional(),
  shift: z.string().max(80).nullable().optional(),
  parity: z.string().max(80).nullable().optional(),
  team: z.string().max(80).nullable().optional(),
  quantity: z.number().int().min(0),
  criticality: z.string().max(80).nullable().optional()
});

export const qlpVersionInputSchema = z.object({
  operationId: z.string().uuid(),
  kind: qlpKindSchema,
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().optional(),
  reason: z.string().min(2).max(500),
  requirements: z.array(qlpRequirementInputSchema).min(1)
});

export const positionInputSchema = z.object({
  operationId: z.string().uuid(),
  functionId: z.string().uuid(),
  workRegime: z.string().max(80).nullable().optional(),
  shift: z.string().max(80).nullable().optional(),
  parity: z.string().max(80).nullable().optional(),
  team: z.string().max(80).nullable().optional(),
  criticality: z.string().max(80).nullable().optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().optional()
});

export const requirementKindSchema = z.enum(["DOCUMENT", "COMPETENCY"]);

export const aptitudeStatusSchema = z.enum(["GREEN", "YELLOW", "RED"]);

export const complianceRequirementInputSchema = z.object({
  operationId: z.string().uuid().nullable().optional(),
  functionId: z.string().uuid().nullable().optional(),
  kind: requirementKindSchema,
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(180),
  description: z.string().max(2000).nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  warningDays: z.number().int().min(0).default(30),
  required: z.boolean().default(true)
});

export const employeeDocumentInputSchema = z.object({
  employeeId: z.string().uuid(),
  requirementId: z.string().uuid(),
  issuedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  fileName: z.string().max(255).nullable().optional(),
  fileUrl: z.string().url().max(2048).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const competencyMatrixItemInputSchema = z.object({
  operationId: z.string().uuid().nullable().optional(),
  functionId: z.string().uuid(),
  competencyCode: z.string().min(1).max(80),
  competencyName: z.string().min(2).max(180),
  requiredLevel: z.number().int().min(1).max(5).default(1),
  validityDays: z.number().int().positive().nullable().optional(),
  warningDays: z.number().int().min(0).default(30),
  required: z.boolean().default(true)
});

export const employeeCompetencyInputSchema = z.object({
  employeeId: z.string().uuid(),
  competencyCode: z.string().min(1).max(80),
  competencyName: z.string().min(2).max(180),
  level: z.number().int().min(1).max(5).default(1),
  achievedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const evaluationStatusSchema = z.enum([
  "DRAFT",
  "IN_RH_REVIEW",
  "APPROVED",
  "REJECTED",
  "ARCHIVED"
]);

export const evaluationCriterionInputSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(180),
  description: z.string().max(2000).nullable().optional(),
  weight: z.number().int().min(1).max(10).default(1)
});

export const evaluationScoreInputSchema = z.object({
  criterionId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  comment: z.string().max(2000).nullable().optional()
});

export const employeeEvaluationInputSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().min(2).max(180),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  notes: z.string().max(4000).nullable().optional(),
  scores: z.array(evaluationScoreInputSchema).default([])
});

export const evaluationTransitionInputSchema = z.object({
  status: z.enum(["IN_RH_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"]),
  reason: z.string().max(1000).nullable().optional()
});

export const developmentPlanItemInputSchema = z.object({
  action: z.string().min(2).max(500),
  owner: z.string().max(160).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional()
});

export const developmentPlanInputSchema = z.object({
  employeeId: z.string().uuid(),
  evaluationId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(180),
  description: z.string().max(4000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  items: z.array(developmentPlanItemInputSchema).default([])
});

export const calendarEventCategorySchema = z.enum([
  "VACATION",
  "LEAVE",
  "TRAINING",
  "ADMISSION",
  "TERMINATION",
  "TIME_OFF",
  "OTHER"
]);

export const eventTypeInputSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(2).max(180),
  category: calendarEventCategorySchema,
  blocksAvailability: z.boolean().default(true),
  requiresApproval: z.boolean().default(false)
});

export const calendarEventInputSchema = z
  .object({
    typeId: z.string().uuid(),
    employeeId: z.string().uuid().nullable().optional(),
    operationId: z.string().uuid().nullable().optional(),
    title: z.string().min(2).max(180),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    allDay: z.boolean().default(false),
    notes: z.string().max(2000).nullable().optional()
  })
  .refine((value) => new Date(value.endsAt) >= new Date(value.startsAt), {
    message: "endsAt must be greater than or equal to startsAt",
    path: ["endsAt"]
  });

export const availabilityQuerySchema = z
  .object({
    employeeId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime()
  })
  .refine((value) => new Date(value.endsAt) >= new Date(value.startsAt), {
    message: "endsAt must be greater than or equal to startsAt",
    path: ["endsAt"]
  });

export const scheduleEngineInputSchema = z.object({
  operationId: z.string().uuid(),
  shift: z.string().max(80).nullable().optional(),
  parity: z.string().max(80).nullable().optional(),
  positions: z.array(
    z.object({
      id: z.string().min(1),
      functionId: z.string().min(1),
      shift: z.string().max(80).nullable().optional(),
      parity: z.string().max(80).nullable().optional(),
      team: z.string().max(80).nullable().optional()
    })
  ),
  employees: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      functionId: z.string().nullable().optional(),
      shift: z.string().max(80).nullable().optional(),
      team: z.string().max(80).nullable().optional(),
      aptitude: z.object({
        status: aptitudeStatusSchema,
        reasonCodes: z.array(z.string().min(1))
      }),
      availability: z.object({
        available: z.boolean(),
        reasonCodes: z.array(z.string().min(1))
      })
    })
  ),
  teamRules: z
    .array(
      z.object({
        team: z.string().min(1).max(80),
        maxAssignments: z.number().int().positive().optional()
      })
    )
    .default([])
});

export const scheduleVersionInputSchema = z.object({
  operationId: z.string().uuid(),
  month: z.string().datetime(),
  engineInput: scheduleEngineInputSchema,
  overrideJustification: z.string().min(5).max(1000).nullable().optional()
});

export const scheduleTransitionInputSchema = z.object({
  status: z.enum(["IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]),
  reason: z.string().max(1000).nullable().optional(),
  overrideJustification: z.string().min(5).max(1000).nullable().optional()
});

export const reportKindSchema = z.enum(["INCONSISTENCIES", "GAPS"]);
