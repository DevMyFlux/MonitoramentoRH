-- Substituição temporária durante afastamentos: o substituto recebe dias de Cobertura (C) nos plantões do titular.
-- Fica vinculada ao afastamento (CalendarEvent) e nada é apagado: cancelar só muda a situação e registra quem/quando/por quê.

-- CreateEnum
CREATE TYPE "SubstitutionRotation" AS ENUM ('HABITUAL', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "LeaveSubstitution" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "leaveEventId" UUID NOT NULL,
    "titularId" UUID NOT NULL,
    "substituteId" UUID NOT NULL,
    "rotation" "SubstitutionRotation" NOT NULL DEFAULT 'HABITUAL',
    "specificParity" "EmployeeParity",
    "parityReferenceMonth" TEXT,
    "coveredDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,
    CONSTRAINT "LeaveSubstitution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveSubstitution_operationId_idx" ON "LeaveSubstitution"("operationId");

-- CreateIndex
CREATE INDEX "LeaveSubstitution_leaveEventId_idx" ON "LeaveSubstitution"("leaveEventId");

-- CreateIndex
CREATE INDEX "LeaveSubstitution_titularId_idx" ON "LeaveSubstitution"("titularId");

-- CreateIndex
CREATE INDEX "LeaveSubstitution_substituteId_idx" ON "LeaveSubstitution"("substituteId");

-- CreateIndex
CREATE INDEX "LeaveSubstitution_status_idx" ON "LeaveSubstitution"("status");

-- AddForeignKey
ALTER TABLE "LeaveSubstitution" ADD CONSTRAINT "LeaveSubstitution_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveSubstitution" ADD CONSTRAINT "LeaveSubstitution_leaveEventId_fkey" FOREIGN KEY ("leaveEventId") REFERENCES "CalendarEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveSubstitution" ADD CONSTRAINT "LeaveSubstitution_titularId_fkey" FOREIGN KEY ("titularId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveSubstitution" ADD CONSTRAINT "LeaveSubstitution_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
