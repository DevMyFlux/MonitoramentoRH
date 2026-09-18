CREATE TYPE "ImportType" AS ENUM ('EMPLOYEES', 'QLP', 'SCHEDULE');

CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'COMMITTED', 'REJECTED');

CREATE TYPE "ImportIssueSeverity" AS ENUM ('ERROR', 'WARNING');

CREATE TABLE "ImportBatch" (
  "id" UUID NOT NULL,
  "type" "ImportType" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID,
  "updatedBy" UUID,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRow" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "raw" JSONB NOT NULL,
  "mapped" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportIssue" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "rowNumber" INTEGER,
  "field" TEXT,
  "value" TEXT,
  "code" TEXT NOT NULL,
  "severity" "ImportIssueSeverity" NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_type_idx" ON "ImportBatch"("type");
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");
CREATE INDEX "ImportBatch_checksum_idx" ON "ImportBatch"("checksum");
CREATE INDEX "ImportRow_batchId_idx" ON "ImportRow"("batchId");
CREATE INDEX "ImportIssue_batchId_idx" ON "ImportIssue"("batchId");
CREATE INDEX "ImportIssue_severity_idx" ON "ImportIssue"("severity");

ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportIssue" ADD CONSTRAINT "ImportIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
