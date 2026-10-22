-- AlterEnum
-- O valor novo do enum só pode ser usado em uma migração seguinte (0016), por isso fica sozinho aqui.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'APPROVER';

-- AlterTable
-- Bloqueio temporário de conta após falhas de login seguidas.
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
