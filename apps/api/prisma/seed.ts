import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type RoleName } from "@prisma/client";
import { defaultRolePermissions, permissionCatalog } from "@my-flux/shared";
import { hashPassword } from "../src/modules/auth/password-service";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://my_flux:my_flux@localhost:5432/my_flux?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const roles: Array<{ name: RoleName; level: number; description: string }> = [
  { name: "DEV", level: 4, description: "Acesso tecnico total ao sistema." },
  { name: "ADMIN", level: 3, description: "Responsavel operacional por escopos atribuidos." },
  { name: "RH", level: 2, description: "Responsavel pelo dominio Pessoas dentro do escopo." },
  { name: "APPROVER", level: 2, description: "Analisa e decide (aprova ou reprova) as escalas enviadas pelo RH." },
  { name: "COMUM", level: 1, description: "Usuario operacional com permissoes explicitas." }
];

// Catálogo e matriz padrão vêm de @my-flux/shared (mesma fonte da migração 0016 e dos testes).
const permissionSeeds = permissionCatalog.map((p) => [p.code, `${p.label}. ${p.description}`] as const);

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        level: role.level,
        description: role.description
      },
      create: role
    });
  }

  for (const [code, description] of permissionSeeds) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description }
    });
  }

  const devRole = await prisma.role.findUniqueOrThrow({ where: { name: "DEV" } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const rhRole = await prisma.role.findUniqueOrThrow({ where: { name: "RH" } });
  const approverRole = await prisma.role.findUniqueOrThrow({ where: { name: "APPROVER" } });
  const comumRole = await prisma.role.findUniqueOrThrow({ where: { name: "COMUM" } });

  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionSeeds.map(([code]) => code) } },
    select: { id: true, code: true }
  });
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
  const rolePermissions: Record<RoleName, readonly string[]> = defaultRolePermissions;
  for (const [roleName, codes] of Object.entries(rolePermissions) as Array<[RoleName, readonly string[]]>) {
    const role = { DEV: devRole, ADMIN: adminRole, RH: rhRole, APPROVER: approverRole, COMUM: comumRole }[roleName];
    for (const code of codes) {
      const permissionId = permissionByCode.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId }
      });
    }
  }

  const passwordHash = hashPassword("ChangeMe!2026");

  await prisma.user.upsert({
    where: { email: "dev@myflux.local" },
    update: { passwordHash, isActive: true, status: "ACTIVE" },
    create: {
      email: "dev@myflux.local",
      name: "Usuario DEV Inicial",
      passwordHash,
      roleId: devRole.id,
      scopes: {
        create: {
          isGlobal: true
        }
      }
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@myflux.local" },
    update: { passwordHash, isActive: true, status: "ACTIVE" },
    create: {
      email: "admin@myflux.local",
      name: "Usuario ADMIN Inicial",
      passwordHash,
      roleId: adminRole.id
    }
  });

  await prisma.user.upsert({
    where: { email: "rh@myflux.local" },
    update: { passwordHash, isActive: true, status: "ACTIVE" },
    create: {
      email: "rh@myflux.local",
      name: "Usuario RH Inicial",
      passwordHash,
      roleId: rhRole.id
    }
  });

  await prisma.user.upsert({
    where: { email: "approver@myflux.local" },
    update: { passwordHash, isActive: true, status: "ACTIVE" },
    create: {
      email: "approver@myflux.local",
      name: "Usuario APROVADOR Inicial",
      passwordHash,
      roleId: approverRole.id
    }
  });

  await prisma.user.upsert({
    where: { email: "comum@myflux.local" },
    update: { passwordHash, isActive: true, status: "ACTIVE" },
    create: {
      email: "comum@myflux.local",
      name: "Usuario COMUM Inicial",
      passwordHash,
      roleId: comumRole.id
    }
  });
}

await main();
await prisma.$disconnect();
