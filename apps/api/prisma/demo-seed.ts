import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://my_flux:my_flux@127.0.0.1:55432/my_flux";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
async function main() {
  const dev = await db.user.findUnique({ where: { email: "dev@myflux.local" } });
  if (!dev) throw new Error("Execute o seed base antes do demo-seed.");
  const company = await db.company.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: {},
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Empresa Demonstrativa",
      document: "00.000.000/0001-00",
      createdBy: dev.id
    }
  });
  const client = await db.client.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    update: {},
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      companyId: company.id,
      name: "Cliente Demonstrativo",
      createdBy: dev.id
    }
  });
  const unit = await db.unit.upsert({
    where: { id: "33333333-3333-4333-8333-333333333333" },
    update: {},
    create: {
      id: "33333333-3333-4333-8333-333333333333",
      companyId: company.id,
      clientId: client.id,
      name: "Unidade Central",
      code: "UC-01",
      createdBy: dev.id
    }
  });
  const contract = await db.contract.upsert({
    where: { id: "44444444-4444-4444-8444-444444444444" },
    update: {},
    create: {
      id: "44444444-4444-4444-8444-444444444444",
      companyId: company.id,
      clientId: client.id,
      name: "Contrato Operacional 2026",
      code: "CTR-2026",
      startsAt: new Date("2026-01-01T00:00:00Z"),
      createdBy: dev.id
    }
  });
  const operation = await db.operation.upsert({
    where: { id: "55555555-5555-4555-8555-555555555555" },
    update: {},
    create: {
      id: "55555555-5555-4555-8555-555555555555",
      companyId: company.id,
      clientId: client.id,
      contractId: contract.id,
      unitId: unit.id,
      name: "Operação Demonstrativa",
      code: "OP-01",
      createdBy: dev.id
    }
  });
  await db.userScope.upsert({
    where: { id: "66666666-6666-4666-8666-666666666666" },
    update: { isGlobal: false, companyId: company.id, operationId: operation.id, unitId: unit.id },
    create: {
      id: "66666666-6666-4666-8666-666666666666",
      userId: dev.id,
      isGlobal: false,
      companyId: company.id,
      operationId: operation.id,
      unitId: unit.id,
      createdBy: dev.id
    }
  });
  const scopedDemoUsers = [
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "admin@myflux.local" },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", email: "rh@myflux.local" },
    { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", email: "comum@myflux.local" }
  ];
  for (const entry of scopedDemoUsers) {
    const user = await db.user.findUnique({ where: { email: entry.email } });
    if (!user) continue;
    await db.userScope.upsert({
      where: { id: entry.id },
      update: {
        userId: user.id,
        isGlobal: false,
        companyId: company.id,
        operationId: operation.id,
        unitId: unit.id,
        status: "ACTIVE"
      },
      create: {
        id: entry.id,
        userId: user.id,
        isGlobal: false,
        companyId: company.id,
        operationId: operation.id,
        unitId: unit.id,
        createdBy: dev.id
      }
    });
    await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE", isActive: true } });
  }
  const electrician = await db.jobFunction.upsert({
    where: { id: "77777777-7777-4777-8777-777777777777" },
    update: {},
    create: {
      id: "77777777-7777-4777-8777-777777777777",
      operationId: operation.id,
      name: "Técnico operacional",
      code: "TEC-01",
      createdBy: dev.id
    }
  });
  const helper = await db.jobFunction.upsert({
    where: { id: "88888888-8888-4888-8888-888888888888" },
    update: {},
    create: {
      id: "88888888-8888-4888-8888-888888888888",
      operationId: operation.id,
      name: "Auxiliar operacional",
      code: "AUX-01",
      createdBy: dev.id
    }
  });
  const shiftConfiguration = {
    timezone: "America/Sao_Paulo",
    startHour: 7,
    durationHours: 8,
    restHours: 11,
    weekdays: [1, 2, 3, 4, 5],
    minimumTeam: 1,
    cycleDays: 1,
    workingDays: 1,
    anchorDate: "2026-01-01"
  };
  await db.operationalParameter.upsert({
    where: { operationId_kind_code: { operationId: operation.id, kind: "SHIFT", code: "DIURNO" } },
    update: { configuration: shiftConfiguration },
    create: {
      operationId: operation.id,
      kind: "SHIFT",
      code: "DIURNO",
      name: "Diurno",
      configuration: shiftConfiguration,
      createdBy: dev.id
    }
  });
  const qlp = await db.qLPVersion.upsert({
    where: {
      operationId_version_kind: { operationId: operation.id, version: 1, kind: "OPERATIONAL" }
    },
    update: { status: "APPROVED" },
    create: {
      operationId: operation.id,
      version: 1,
      kind: "OPERATIONAL",
      validFrom: new Date("2026-01-01T00:00:00Z"),
      reason: "Carga demonstrativa",
      status: "APPROVED",
      approvedBy: dev.id,
      approvedAt: new Date(),
      createdBy: dev.id,
      requirements: {
        create: [
          { functionId: electrician.id, shift: "DIURNO", quantity: 2, team: "A" },
          { functionId: helper.id, shift: "DIURNO", quantity: 1, team: "A" }
        ]
      }
    }
  });
  const existingPositions = await db.position.count({
    where: { qlpVersionId: qlp.id, status: "ACTIVE" }
  });
  if (existingPositions === 0) {
    const qlpRequirements = await db.qLPRequirement.findMany({ where: { versionId: qlp.id } });
    for (const qlpRequirement of qlpRequirements) {
      for (let index = 0; index < qlpRequirement.quantity; index += 1) {
        await db.position.create({
          data: {
            qlpVersionId: qlp.id,
            operationId: operation.id,
            functionId: qlpRequirement.functionId,
            workRegime: qlpRequirement.workRegime,
            shift: qlpRequirement.shift,
            parity: qlpRequirement.parity,
            team: qlpRequirement.team,
            criticality: qlpRequirement.criticality,
            validFrom: qlp.validFrom,
            validTo: qlp.validTo,
            createdBy: dev.id
          }
        });
      }
    }
  }
  const requirement = await db.complianceRequirement.upsert({
    where: { id: "99999999-9999-4999-8999-999999999999" },
    update: {},
    create: {
      id: "99999999-9999-4999-8999-999999999999",
      operationId: operation.id,
      functionId: electrician.id,
      kind: "DOCUMENT",
      code: "ASO",
      name: "ASO vigente",
      required: true,
      warningDays: 30,
      createdBy: dev.id
    }
  });
  const employee = await db.employee.upsert({
    where: { operationId_identifier: { operationId: operation.id, identifier: "DEMO-001" } },
    update: {},
    create: {
      operationId: operation.id,
      functionId: electrician.id,
      name: "Pessoa Demonstrativa",
      identifier: "DEMO-001",
      jobTitle: "Técnico operacional",
      admissionDate: new Date("2025-01-02T00:00:00Z"),
      shift: "DIURNO",
      team: "A",
      createdBy: dev.id
    }
  });
  await db.employeeDocument.upsert({
    where: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    update: {},
    create: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      employeeId: employee.id,
      requirementId: requirement.id,
      issuedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2026-12-31T00:00:00Z"),
      createdBy: dev.id
    }
  });
  await db.employeeAssignment.deleteMany({ where: { employeeId: employee.id, positionId: null } });
  console.log(
    JSON.stringify({
      company: company.name,
      operation: operation.name,
      qlpVersion: qlp.version,
      employee: employee.identifier
    })
  );
}
await main();
await db.$disconnect();
