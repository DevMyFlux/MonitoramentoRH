import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type RoleName } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password-service";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://my_flux:my_flux@localhost:5432/my_flux?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const roles: Array<{ name: RoleName; level: number; description: string }> = [
  { name: "DEV", level: 4, description: "Acesso tecnico total ao sistema." },
  { name: "ADMIN", level: 3, description: "Responsavel operacional por escopos atribuidos." },
  { name: "RH", level: 2, description: "Responsavel pelo dominio Pessoas dentro do escopo." },
  { name: "COMUM", level: 1, description: "Usuario operacional com permissoes explicitas." }
];

const permissionSeeds = [
  ["users:create", "Criar usuarios respeitando a hierarquia."],
  ["users:invite", "Convidar usuarios respeitando a hierarquia."],
  ["auth:me", "Consultar a propria sessao."],
  ["audit:read", "Consultar auditoria permitida."],
  ["scope:manage", "Gerenciar escopos permitidos."]
] as const;

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
  const comumRole = await prisma.role.findUniqueOrThrow({ where: { name: "COMUM" } });

  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionSeeds.map(([code]) => code) } },
    select: { id: true, code: true }
  });
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
  const rolePermissions: Record<RoleName, string[]> = {
    DEV: permissionSeeds.map(([code]) => code),
    ADMIN: ["users:create", "users:invite", "auth:me", "audit:read", "scope:manage"],
    RH: ["users:create", "users:invite", "auth:me"],
    COMUM: ["auth:me"]
  };
  for (const [roleName, codes] of Object.entries(rolePermissions) as Array<[RoleName, string[]]>) {
    const role = { DEV: devRole, ADMIN: adminRole, RH: rhRole, COMUM: comumRole }[roleName];
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
