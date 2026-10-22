-- AlterTable
-- Integridade da aprovação: a decisão fica atrelada ao conteúdo (hash) e à revisão que o aprovador viu; reprovação guarda
-- quem, quando e por quê; editar uma escala enviada/aprovada/publicada gera nova versão (basedOnVersionId) e a anterior
-- fica marcada como substituída, sem perder a situação que tinha. Tudo opcional: versões antigas continuam válidas.
ALTER TABLE "ScheduleVersion" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "submittedBy" UUID,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" UUID,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "approvedContentHash" TEXT,
ADD COLUMN     "basedOnVersionId" UUID,
ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "supersededById" UUID;

-- CreateIndex
CREATE INDEX "ScheduleVersion_basedOnVersionId_idx" ON "ScheduleVersion"("basedOnVersionId");
