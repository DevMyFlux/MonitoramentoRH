-- Desfaz 0023_contas_cargo_nivel_area (aplicado à mão; o Prisma Migrate não executa migrações de descida).
-- ATENÇÃO: apaga o cargo, o nível de governança e a área já gravados nas contas e nos convites, e a
-- lista de áreas. Faça backup antes.
DROP INDEX IF EXISTS "public"."User_areaId_idx";
ALTER TABLE "public"."UserInvitation" DROP CONSTRAINT IF EXISTS "UserInvitation_areaId_fkey";
ALTER TABLE "public"."User" DROP CONSTRAINT IF EXISTS "User_areaId_fkey";
ALTER TABLE "public"."UserInvitation" DROP CONSTRAINT IF EXISTS "UserInvitation_cargo_check";
ALTER TABLE "public"."User" DROP CONSTRAINT IF EXISTS "User_cargo_check";
ALTER TABLE "public"."UserInvitation"
    DROP COLUMN IF EXISTS "areaId",
    DROP COLUMN IF EXISTS "nivelGovernanca",
    DROP COLUMN IF EXISTS "cargo";
ALTER TABLE "public"."User"
    DROP COLUMN IF EXISTS "areaId",
    DROP COLUMN IF EXISTS "nivelGovernanca",
    DROP COLUMN IF EXISTS "cargo";
DROP TABLE IF EXISTS "public"."Area";
DROP TYPE IF EXISTS "public"."NivelGovernanca";
