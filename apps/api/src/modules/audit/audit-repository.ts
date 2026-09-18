import { Prisma, type AuditAction, type PrismaClient } from "@prisma/client";

export type AuditFilters = {
  entity?: string | undefined;
  action?: AuditAction | undefined;
  q?: string | undefined;
};

export class AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(filters: AuditFilters) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.entity) {
      where.entity = { contains: filters.entity, mode: "insensitive" };
    }
    if (filters.action) {
      where.action = { equals: filters.action };
    }
    if (filters.q) {
      where.OR = [
        { entity: { contains: filters.q, mode: "insensitive" } },
        { entityId: { contains: filters.q, mode: "insensitive" } },
        { origin: { contains: filters.q, mode: "insensitive" } }
      ];
    }

    return this.db.auditLog.findMany({
      where,
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }
}
