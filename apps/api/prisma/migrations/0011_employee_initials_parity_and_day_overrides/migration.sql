-- CreateEnum
CREATE TYPE "EmployeeParity" AS ENUM ('ODD', 'EVEN');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "initials" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "parity" "EmployeeParity";

-- CreateTable
CREATE TABLE "ScheduleDayOverride" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "code" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleDayOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleDayOverride_operationId_idx" ON "ScheduleDayOverride"("operationId");

-- CreateIndex
CREATE INDEX "ScheduleDayOverride_employeeId_idx" ON "ScheduleDayOverride"("employeeId");

-- CreateIndex
CREATE INDEX "ScheduleDayOverride_date_idx" ON "ScheduleDayOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDayOverride_operationId_employeeId_date_key" ON "ScheduleDayOverride"("operationId", "employeeId", "date");

-- AddForeignKey
ALTER TABLE "ScheduleDayOverride" ADD CONSTRAINT "ScheduleDayOverride_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDayOverride" ADD CONSTRAINT "ScheduleDayOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
