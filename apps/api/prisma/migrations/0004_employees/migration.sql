CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'VACATION', 'TERMINATED', 'SCHEDULED_ADMISSION');

CREATE TABLE "Employee" (
  "id" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "functionId" UUID,
  "name" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "employmentType" TEXT,
  "jobTitle" TEXT,
  "admissionDate" TIMESTAMP(3),
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "workRegime" TEXT,
  "shift" TEXT,
  "team" TEXT,
  "notes" TEXT,
  "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeAssignment" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "positionId" UUID,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "EmployeeAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeHistory" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID,
  CONSTRAINT "EmployeeHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_operationId_identifier_key" ON "Employee"("operationId", "identifier");
CREATE INDEX "Employee_operationId_idx" ON "Employee"("operationId");
CREATE INDEX "Employee_functionId_idx" ON "Employee"("functionId");
CREATE INDEX "Employee_status_idx" ON "Employee"("status");
CREATE INDEX "EmployeeAssignment_employeeId_idx" ON "EmployeeAssignment"("employeeId");
CREATE INDEX "EmployeeAssignment_positionId_idx" ON "EmployeeAssignment"("positionId");
CREATE INDEX "EmployeeHistory_employeeId_idx" ON "EmployeeHistory"("employeeId");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeHistory" ADD CONSTRAINT "EmployeeHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
