import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type AuditAction, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { canAccessScope } from "../identity/scope-policy.js";

type EntityName =
  | "Company"
  | "Client"
  | "Unit"
  | "Contract"
  | "Operation"
  | "Service"
  | "Obligation"
  | "JobFunction";

type CompanyInput = {
  name: string;
  document?: string | null | undefined;
};

type UpdateCompanyInput = {
  name?: string | undefined;
  document?: string | null | undefined;
};

type ClientInput = CompanyInput & {
  companyId: string;
};

type UpdateClientInput = UpdateCompanyInput & {
  companyId?: string | undefined;
};

type UnitInput = {
  companyId: string;
  clientId?: string | null | undefined;
  name: string;
  code?: string | null | undefined;
};

type UpdateUnitInput = {
  companyId?: string | undefined;
  clientId?: string | null | undefined;
  name?: string | undefined;
  code?: string | null | undefined;
};

type ContractInput = UnitInput & {
  clientId: string;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
};

type UpdateContractInput = UpdateUnitInput & {
  clientId?: string | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
};

type OperationInput = {
  companyId: string;
  clientId: string;
  contractId?: string | null | undefined;
  unitId: string;
  name: string;
  code?: string | null | undefined;
};

type UpdateOperationInput = {
  companyId?: string | undefined;
  clientId?: string | undefined;
  contractId?: string | null | undefined;
  unitId?: string | undefined;
  name?: string | undefined;
  code?: string | null | undefined;
};

type ServiceInput = {
  operationId: string;
  name: string;
  code?: string | null | undefined;
};

type UpdateServiceInput = {
  operationId?: string | undefined;
  name?: string | undefined;
  code?: string | null | undefined;
};

type ObligationInput = {
  operationId: string;
  serviceId?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
};

type UpdateObligationInput = {
  operationId?: string | undefined;
  serviceId?: string | null | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
};

type JobFunctionInput = {
  operationId?: string | null | undefined;
  name: string;
  code?: string | null | undefined;
  description?: string | null | undefined;
};

type UpdateJobFunctionInput = {
  operationId?: string | null | undefined;
  name?: string | undefined;
  code?: string | null | undefined;
  description?: string | null | undefined;
};

export class OperationalRepository {
  constructor(private readonly db: PrismaClient) {}

  async listCompanies(user: AuthenticatedUser) {
    return this.db.company.findMany({
      where: {
        status: "ACTIVE",
        ...scopeWhere(user, "companyId")
      },
      orderBy: { name: "asc" }
    });
  }

  async createCompany(user: AuthenticatedUser, data: CompanyInput) {
    const created = await this.db.company.create({
      data: {
        name: data.name,
        document: data.document ?? null,
        createdBy: user.id
      }
    });

    await this.audit(user, "CREATE", "Company", created.id, null, created);
    return created;
  }

  async updateCompany(user: AuthenticatedUser, id: string, data: UpdateCompanyInput) {
    await this.assertCompanyScope(user, id);
    const before = await this.db.company.findUniqueOrThrow({ where: { id } });
    const updateData: Prisma.CompanyUpdateInput = { updatedBy: user.id };
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.document !== undefined) {
      updateData.document = data.document;
    }
    const updated = await this.db.company.update({
      where: { id },
      data: updateData
    });

    await this.audit(user, "UPDATE", "Company", id, before, updated);
    return updated;
  }

  async archiveCompany(user: AuthenticatedUser, id: string) {
    await this.assertCompanyScope(user, id);
    const before = await this.db.company.findUniqueOrThrow({ where: { id } });
    const updated = await this.db.company.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });

    await this.audit(user, "ARCHIVE", "Company", id, before, updated);
    return updated;
  }

  async listClients(user: AuthenticatedUser) {
    return this.db.client.findMany({
      where: { status: "ACTIVE", ...scopeWhere(user, "companyId") },
      orderBy: { name: "asc" }
    });
  }

  async createClient(user: AuthenticatedUser, data: ClientInput) {
    assertScoped(user, { companyId: data.companyId });
    const created = await this.db.client.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        document: data.document ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "Client", created.id, null, created);
    return created;
  }

  async updateClient(user: AuthenticatedUser, id: string, data: UpdateClientInput) {
    const before = await this.db.client.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId });
    if (data.companyId) {
      assertScoped(user, { companyId: data.companyId });
    }
    const updateData: Prisma.ClientUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "companyId", data.companyId);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "document", data.document);
    const updated = await this.db.client.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "Client", id, before, updated);
    return updated;
  }

  async archiveClient(user: AuthenticatedUser, id: string) {
    const before = await this.db.client.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId });
    const updated = await this.db.client.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "Client", id, before, updated);
    return updated;
  }

  async listUnits(user: AuthenticatedUser) {
    return this.db.unit.findMany({
      where: { status: "ACTIVE", ...scopeWhere(user, "companyId") },
      orderBy: { name: "asc" }
    });
  }

  async createUnit(user: AuthenticatedUser, data: UnitInput) {
    assertScoped(user, { companyId: data.companyId });
    const created = await this.db.unit.create({
      data: {
        companyId: data.companyId,
        clientId: data.clientId ?? null,
        name: data.name,
        code: data.code ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "Unit", created.id, null, created);
    return created;
  }

  async updateUnit(user: AuthenticatedUser, id: string, data: UpdateUnitInput) {
    const before = await this.db.unit.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId, unitId: id });
    if (data.companyId) {
      assertScoped(user, { companyId: data.companyId });
    }
    const updateData: Prisma.UnitUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "companyId", data.companyId);
    applyDefined(updateData, "clientId", data.clientId);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "code", data.code);
    const updated = await this.db.unit.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "Unit", id, before, updated);
    return updated;
  }

  async archiveUnit(user: AuthenticatedUser, id: string) {
    const before = await this.db.unit.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId, unitId: id });
    const updated = await this.db.unit.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "Unit", id, before, updated);
    return updated;
  }

  async listContracts(user: AuthenticatedUser) {
    return this.db.contract.findMany({
      where: { status: "ACTIVE", ...scopeWhere(user, "companyId") },
      orderBy: { name: "asc" }
    });
  }

  async createContract(user: AuthenticatedUser, data: ContractInput) {
    assertScoped(user, { companyId: data.companyId });
    const created = await this.db.contract.create({
      data: {
        companyId: data.companyId,
        clientId: data.clientId,
        name: data.name,
        code: data.code ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "Contract", created.id, null, created);
    return created;
  }

  async updateContract(user: AuthenticatedUser, id: string, data: UpdateContractInput) {
    const before = await this.db.contract.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId });
    if (data.companyId) {
      assertScoped(user, { companyId: data.companyId });
    }
    const updateData: Prisma.ContractUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "companyId", data.companyId);
    applyDefined(updateData, "clientId", data.clientId);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "code", data.code);
    applyDefined(updateData, "startsAt", data.startsAt ? new Date(data.startsAt) : data.startsAt);
    applyDefined(updateData, "endsAt", data.endsAt ? new Date(data.endsAt) : data.endsAt);
    const updated = await this.db.contract.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "Contract", id, before, updated);
    return updated;
  }

  async archiveContract(user: AuthenticatedUser, id: string) {
    const before = await this.db.contract.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId });
    const updated = await this.db.contract.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "Contract", id, before, updated);
    return updated;
  }

  async listOperations(user: AuthenticatedUser) {
    return this.db.operation.findMany({
      where: {
        status: "ACTIVE",
        ...operationScopeWhere(user)
      },
      orderBy: { name: "asc" }
    });
  }

  async createOperation(user: AuthenticatedUser, data: OperationInput) {
    assertScoped(user, {
      companyId: data.companyId,
      operationId: null,
      unitId: data.unitId
    });
    const created = await this.db.operation.create({
      data: {
        companyId: data.companyId,
        clientId: data.clientId,
        contractId: data.contractId ?? null,
        unitId: data.unitId,
        name: data.name,
        code: data.code ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "Operation", created.id, null, created);
    return created;
  }

  async updateOperation(user: AuthenticatedUser, id: string, data: UpdateOperationInput) {
    const before = await this.db.operation.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId, operationId: id, unitId: before.unitId });
    if (data.companyId || data.unitId) {
      assertScoped(user, {
        companyId: data.companyId ?? before.companyId,
        unitId: data.unitId ?? before.unitId
      });
    }
    const updateData: Prisma.OperationUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "companyId", data.companyId);
    applyDefined(updateData, "clientId", data.clientId);
    applyDefined(updateData, "contractId", data.contractId);
    applyDefined(updateData, "unitId", data.unitId);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "code", data.code);
    const updated = await this.db.operation.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "Operation", id, before, updated);
    return updated;
  }

  async archiveOperation(user: AuthenticatedUser, id: string) {
    const before = await this.db.operation.findUniqueOrThrow({ where: { id } });
    assertScoped(user, { companyId: before.companyId, operationId: id, unitId: before.unitId });
    const updated = await this.db.operation.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "Operation", id, before, updated);
    return updated;
  }

  async listServices(user: AuthenticatedUser) {
    return this.db.service.findMany({
      where: {
        status: "ACTIVE",
        operation: operationScopeWhere(user)
      },
      orderBy: { name: "asc" }
    });
  }

  async createService(user: AuthenticatedUser, data: ServiceInput) {
    await this.assertOperationScope(user, data.operationId);
    const created = await this.db.service.create({
      data: {
        operationId: data.operationId,
        name: data.name,
        code: data.code ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "Service", created.id, null, created);
    return created;
  }

  async updateService(user: AuthenticatedUser, id: string, data: UpdateServiceInput) {
    const before = await this.db.service.findUniqueOrThrow({ where: { id } });
    await this.assertOperationScope(user, before.operationId);
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }
    const updateData: Prisma.ServiceUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "operationId", data.operationId);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "code", data.code);
    const updated = await this.db.service.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "Service", id, before, updated);
    return updated;
  }

  async archiveService(user: AuthenticatedUser, id: string) {
    const before = await this.db.service.findUniqueOrThrow({ where: { id } });
    await this.assertOperationScope(user, before.operationId);
    const updated = await this.db.service.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "Service", id, before, updated);
    return updated;
  }

  async listObligations(user: AuthenticatedUser) {
    return this.db.obligation.findMany({
      where: {
        status: "ACTIVE",
        operation: operationScopeWhere(user)
      },
      orderBy: { title: "asc" }
    });
  }

  async createObligation(user: AuthenticatedUser, data: ObligationInput) {
    await this.assertOperationScope(user, data.operationId);
    const created = await this.db.obligation.create({
      data: {
        operationId: data.operationId,
        serviceId: data.serviceId ?? null,
        title: data.title,
        description: data.description ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "Obligation", created.id, null, created);
    return created;
  }

  async updateObligation(user: AuthenticatedUser, id: string, data: UpdateObligationInput) {
    const before = await this.db.obligation.findUniqueOrThrow({ where: { id } });
    await this.assertOperationScope(user, before.operationId);
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }
    const updateData: Prisma.ObligationUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "operationId", data.operationId);
    applyDefined(updateData, "serviceId", data.serviceId);
    applyDefined(updateData, "title", data.title);
    applyDefined(updateData, "description", data.description);
    const updated = await this.db.obligation.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "Obligation", id, before, updated);
    return updated;
  }

  async archiveObligation(user: AuthenticatedUser, id: string) {
    const before = await this.db.obligation.findUniqueOrThrow({ where: { id } });
    await this.assertOperationScope(user, before.operationId);
    const updated = await this.db.obligation.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "Obligation", id, before, updated);
    return updated;
  }

  async listJobFunctions(user: AuthenticatedUser) {
    // DEV/global users must NOT go through the `OR: [{ operationId: null }, { operation: {} }]`
    // shape below: Prisma drops an empty relation filter used as an OR branch instead of
    // treating it as "always true", which silently turned this into "operationId: null" only
    // and hid every scoped function from unrestricted users. Skip the OR entirely for them.
    const unrestricted = user.role === "DEV" || user.scopes.some((scope) => scope.isGlobal);
    return this.db.jobFunction.findMany({
      where: {
        status: "ACTIVE",
        ...(unrestricted
          ? {}
          : { OR: [{ operationId: null }, { operation: operationScopeWhere(user) }] })
      },
      orderBy: { name: "asc" }
    });
  }

  async createJobFunction(user: AuthenticatedUser, data: JobFunctionInput) {
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }
    const created = await this.db.jobFunction.create({
      data: {
        operationId: data.operationId ?? null,
        name: data.name,
        code: data.code ?? null,
        description: data.description ?? null,
        createdBy: user.id
      }
    });
    await this.audit(user, "CREATE", "JobFunction", created.id, null, created);
    return created;
  }

  async updateJobFunction(user: AuthenticatedUser, id: string, data: UpdateJobFunctionInput) {
    const before = await this.db.jobFunction.findUniqueOrThrow({ where: { id } });
    if (before.operationId) {
      await this.assertOperationScope(user, before.operationId);
    }
    if (data.operationId) {
      await this.assertOperationScope(user, data.operationId);
    }
    const updateData: Prisma.JobFunctionUncheckedUpdateInput = { updatedBy: user.id };
    applyDefined(updateData, "operationId", data.operationId);
    applyDefined(updateData, "name", data.name);
    applyDefined(updateData, "code", data.code);
    applyDefined(updateData, "description", data.description);
    const updated = await this.db.jobFunction.update({ where: { id }, data: updateData });
    await this.audit(user, "UPDATE", "JobFunction", id, before, updated);
    return updated;
  }

  async archiveJobFunction(user: AuthenticatedUser, id: string) {
    const before = await this.db.jobFunction.findUniqueOrThrow({ where: { id } });
    if (before.operationId) {
      await this.assertOperationScope(user, before.operationId);
    }
    const updated = await this.db.jobFunction.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), updatedBy: user.id }
    });
    await this.audit(user, "ARCHIVE", "JobFunction", id, before, updated);
    return updated;
  }

  private async assertCompanyScope(user: AuthenticatedUser, companyId: string): Promise<void> {
    assertScoped(user, { companyId });
  }

  private async assertOperationScope(user: AuthenticatedUser, operationId: string): Promise<void> {
    const operation = await this.db.operation.findUnique({
      where: { id: operationId },
      select: { companyId: true, unitId: true }
    });

    if (!operation) {
      throw new HttpError(404, "OPERATION_NOT_FOUND", "Operacao nao encontrada.");
    }

    assertScoped(user, {
      companyId: operation.companyId,
      operationId,
      unitId: operation.unitId
    });
  }

  private async audit(
    user: AuthenticatedUser,
    action: AuditAction,
    entity: EntityName,
    entityId: string,
    before: unknown,
    after: unknown
  ): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action,
        entity,
        entityId,
        before: before === null ? Prisma.JsonNull : toJson(before),
        after: toJson(after),
        origin: "api"
      }
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function applyDefined<TTarget extends object, TKey extends keyof TTarget>(
  target: TTarget,
  key: TKey,
  value: TTarget[TKey] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function assertScoped(
  user: AuthenticatedUser,
  resource: { companyId?: string | null; operationId?: string | null; unitId?: string | null }
): void {
  if (user.role === "DEV" || canAccessScope(user.scopes, resource)) {
    return;
  }

  throw new HttpError(403, "SCOPE_FORBIDDEN", "Recurso fora do escopo permitido.");
}

function scopeWhere(user: AuthenticatedUser, field: "companyId"): Record<string, unknown> {
  if (user.role === "DEV" || user.scopes.some((scope) => scope.isGlobal)) {
    return {};
  }

  const values = user.scopes
    .map((scope) => scope[field])
    .filter((value): value is string => Boolean(value));

  return values.length > 0 ? { [field]: { in: values } } : { id: { in: [] } };
}

function operationScopeWhere(user: AuthenticatedUser): Record<string, unknown> {
  if (user.role === "DEV" || user.scopes.some((scope) => scope.isGlobal)) {
    return {};
  }

  return {
    OR: user.scopes.map((scope) => ({
      companyId: scope.companyId ?? undefined,
      id: scope.operationId ?? undefined,
      unitId: scope.unitId ?? undefined
    }))
  };
}
