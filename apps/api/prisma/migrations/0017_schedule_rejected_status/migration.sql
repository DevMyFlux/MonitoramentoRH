-- AlterEnum
-- Escala reprovada pelo aprovador (com motivo). Fica sozinha nesta migração: o valor novo do enum só pode ser usado depois.
ALTER TYPE "WorkflowStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
