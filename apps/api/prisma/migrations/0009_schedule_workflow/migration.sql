CREATE TABLE "ScheduleVersion" (
  "id" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "month" TIMESTAMP(3) NOT NULL,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "generatedInput" JSONB NOT NULL,
  "generatedResult" JSONB NOT NULL,
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP(3),
  "publishedBy" UUID,
  "publishedAt" TIMESTAMP(3),
  "overrideJustification" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleAssignment" (
  "id" UUID NOT NULL,
  "scheduleId" UUID NOT NULL,
  "positionId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "ruleBroken" BOOLEAN NOT NULL DEFAULT false,
  "justification" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  CONSTRAINT "ScheduleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleHistory" (
  "id" UUID NOT NULL,
  "scheduleId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID,
  CONSTRAINT "ScheduleHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleVersion_operationId_version_month_key" ON "ScheduleVersion"("operationId", "version", "month");
CREATE INDEX "ScheduleVersion_operationId_idx" ON "ScheduleVersion"("operationId");
CREATE INDEX "ScheduleVersion_status_idx" ON "ScheduleVersion"("status");
CREATE INDEX "ScheduleVersion_month_idx" ON "ScheduleVersion"("month");
CREATE INDEX "ScheduleAssignment_scheduleId_idx" ON "ScheduleAssignment"("scheduleId");
CREATE INDEX "ScheduleAssignment_employeeId_idx" ON "ScheduleAssignment"("employeeId");
CREATE INDEX "ScheduleAssignment_positionId_idx" ON "ScheduleAssignment"("positionId");
CREATE INDEX "ScheduleHistory_scheduleId_idx" ON "ScheduleHistory"("scheduleId");

ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleHistory" ADD CONSTRAINT "ScheduleHistory_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
