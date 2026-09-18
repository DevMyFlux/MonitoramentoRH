CREATE TYPE "QLPKind" AS ENUM ('CONTRACTUAL', 'OPERATIONAL');
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "QLPVersion" (
  "id" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "kind" "QLPKind" NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "QLPVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QLPRequirement" (
  "id" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "functionId" UUID NOT NULL,
  "workRegime" TEXT,
  "shift" TEXT,
  "parity" TEXT,
  "team" TEXT,
  "quantity" INTEGER NOT NULL,
  "criticality" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "QLPRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Position" (
  "id" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "functionId" UUID NOT NULL,
  "workRegime" TEXT,
  "shift" TEXT,
  "parity" TEXT,
  "team" TEXT,
  "criticality" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QLPVersion_operationId_version_kind_key" ON "QLPVersion"("operationId", "version", "kind");
CREATE INDEX "QLPVersion_operationId_idx" ON "QLPVersion"("operationId");
CREATE INDEX "QLPVersion_status_idx" ON "QLPVersion"("status");
CREATE INDEX "QLPRequirement_versionId_idx" ON "QLPRequirement"("versionId");
CREATE INDEX "QLPRequirement_functionId_idx" ON "QLPRequirement"("functionId");
CREATE INDEX "Position_operationId_idx" ON "Position"("operationId");
CREATE INDEX "Position_functionId_idx" ON "Position"("functionId");

ALTER TABLE "QLPVersion" ADD CONSTRAINT "QLPVersion_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QLPRequirement" ADD CONSTRAINT "QLPRequirement_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "QLPVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QLPRequirement" ADD CONSTRAINT "QLPRequirement_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
