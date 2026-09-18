-- CreateEnum
CREATE TYPE "AdmissionStage" AS ENUM ('REQUESTED', 'RECRUITING', 'SELECTED', 'DOCUMENTATION', 'MEDICAL_EXAM', 'ADMISSION_SCHEDULED', 'ADMITTED', 'WITHDRAWN', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "qlpVersionId" UUID;

-- CreateTable
CREATE TABLE "RecruitmentRequest" (
    "id" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "desiredDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateApplication" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "stage" "AdmissionStage" NOT NULL DEFAULT 'REQUESTED',
    "admissionDate" TIMESTAMP(3),
    "documentsChecked" BOOLEAN NOT NULL DEFAULT false,
    "medicalCleared" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentStageHistory" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromStage" "AdmissionStage",
    "toStage" "AdmissionStage" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalParameter" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruitmentRequest_positionId_status_idx" ON "RecruitmentRequest"("positionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateApplication_employeeId_key" ON "CandidateApplication"("employeeId");

-- CreateIndex
CREATE INDEX "CandidateApplication_requestId_stage_idx" ON "CandidateApplication"("requestId", "stage");

-- CreateIndex
CREATE INDEX "RecruitmentStageHistory_applicationId_idx" ON "RecruitmentStageHistory"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalParameter_operationId_kind_code_key" ON "OperationalParameter"("operationId", "kind", "code");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_qlpVersionId_fkey" FOREIGN KEY ("qlpVersionId") REFERENCES "QLPVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateApplication" ADD CONSTRAINT "CandidateApplication_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruitmentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateApplication" ADD CONSTRAINT "CandidateApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentStageHistory" ADD CONSTRAINT "RecruitmentStageHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
