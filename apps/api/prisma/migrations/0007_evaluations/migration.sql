CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'IN_RH_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

CREATE TABLE "EvaluationCriterion" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeEvaluation" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "EmployeeEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationScore" (
  "id" UUID NOT NULL,
  "evaluationId" UUID NOT NULL,
  "criterionId" UUID NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DevelopmentPlan" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "evaluationId" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "DevelopmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DevelopmentPlanItem" (
  "id" UUID NOT NULL,
  "planId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "owner" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "DevelopmentPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationHistory" (
  "id" UUID NOT NULL,
  "evaluationId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID,
  CONSTRAINT "EvaluationHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvaluationCriterion_code_key" ON "EvaluationCriterion"("code");
CREATE INDEX "EmployeeEvaluation_employeeId_idx" ON "EmployeeEvaluation"("employeeId");
CREATE INDEX "EmployeeEvaluation_status_idx" ON "EmployeeEvaluation"("status");
CREATE UNIQUE INDEX "EvaluationScore_evaluationId_criterionId_key" ON "EvaluationScore"("evaluationId", "criterionId");
CREATE INDEX "EvaluationScore_evaluationId_idx" ON "EvaluationScore"("evaluationId");
CREATE INDEX "EvaluationScore_criterionId_idx" ON "EvaluationScore"("criterionId");
CREATE INDEX "DevelopmentPlan_employeeId_idx" ON "DevelopmentPlan"("employeeId");
CREATE INDEX "DevelopmentPlan_evaluationId_idx" ON "DevelopmentPlan"("evaluationId");
CREATE INDEX "DevelopmentPlan_status_idx" ON "DevelopmentPlan"("status");
CREATE INDEX "DevelopmentPlanItem_planId_idx" ON "DevelopmentPlanItem"("planId");
CREATE INDEX "EvaluationHistory_evaluationId_idx" ON "EvaluationHistory"("evaluationId");

ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EmployeeEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EmployeeEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DevelopmentPlanItem" ADD CONSTRAINT "DevelopmentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationHistory" ADD CONSTRAINT "EvaluationHistory_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EmployeeEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
