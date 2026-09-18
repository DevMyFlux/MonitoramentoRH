CREATE TYPE "RequirementKind" AS ENUM ('DOCUMENT', 'COMPETENCY');
CREATE TYPE "AptitudeStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

CREATE TABLE "ComplianceRequirement" (
  "id" UUID NOT NULL,
  "operationId" UUID,
  "functionId" UUID,
  "kind" "RequirementKind" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "validityDays" INTEGER,
  "warningDays" INTEGER NOT NULL DEFAULT 30,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ComplianceRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeDocument" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "fileName" TEXT,
  "fileUrl" TEXT,
  "notes" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetencyMatrixItem" (
  "id" UUID NOT NULL,
  "operationId" UUID,
  "functionId" UUID NOT NULL,
  "competencyCode" TEXT NOT NULL,
  "competencyName" TEXT NOT NULL,
  "requiredLevel" INTEGER NOT NULL DEFAULT 1,
  "validityDays" INTEGER,
  "warningDays" INTEGER NOT NULL DEFAULT 30,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "CompetencyMatrixItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeCompetency" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "competencyCode" TEXT NOT NULL,
  "competencyName" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "achievedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "EmployeeCompetency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceRequirement_operationId_functionId_kind_code_key" ON "ComplianceRequirement"("operationId", "functionId", "kind", "code");
CREATE INDEX "ComplianceRequirement_operationId_idx" ON "ComplianceRequirement"("operationId");
CREATE INDEX "ComplianceRequirement_functionId_idx" ON "ComplianceRequirement"("functionId");
CREATE INDEX "ComplianceRequirement_kind_idx" ON "ComplianceRequirement"("kind");
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");
CREATE INDEX "EmployeeDocument_requirementId_idx" ON "EmployeeDocument"("requirementId");
CREATE INDEX "EmployeeDocument_expiresAt_idx" ON "EmployeeDocument"("expiresAt");
CREATE UNIQUE INDEX "CompetencyMatrixItem_operationId_functionId_competencyCode_key" ON "CompetencyMatrixItem"("operationId", "functionId", "competencyCode");
CREATE INDEX "CompetencyMatrixItem_operationId_idx" ON "CompetencyMatrixItem"("operationId");
CREATE INDEX "CompetencyMatrixItem_functionId_idx" ON "CompetencyMatrixItem"("functionId");
CREATE INDEX "EmployeeCompetency_employeeId_idx" ON "EmployeeCompetency"("employeeId");
CREATE INDEX "EmployeeCompetency_competencyCode_idx" ON "EmployeeCompetency"("competencyCode");
CREATE INDEX "EmployeeCompetency_expiresAt_idx" ON "EmployeeCompetency"("expiresAt");

ALTER TABLE "ComplianceRequirement" ADD CONSTRAINT "ComplianceRequirement_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceRequirement" ADD CONSTRAINT "ComplianceRequirement_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ComplianceRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetencyMatrixItem" ADD CONSTRAINT "CompetencyMatrixItem_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetencyMatrixItem" ADD CONSTRAINT "CompetencyMatrixItem_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeCompetency" ADD CONSTRAINT "EmployeeCompetency_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
