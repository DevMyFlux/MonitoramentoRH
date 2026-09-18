import { employeeInputSchema } from "@my-flux/validation";
import { scopedOperation } from "../identity/access.js";
import { assertCanImport } from "./import-policy.js";
import type { AuthenticatedUser } from "@my-flux/types";
import { Prisma, type ImportType, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import type { ImportIssue, ParsedImportRow } from "./import-parser.js";
import type { EmployeeRepository } from "../employees/employee-repository.js";

type CreateImportBatchData = {
  type: ImportType;
  fileName: string;
  fileSize: number;
  checksum: string;
  rows: ParsedImportRow[];
  issues: ImportIssue[];
};

export class ImportRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly employees?: EmployeeRepository
  ) {}

  async list(user: AuthenticatedUser) {

    return this.db.importBatch.findMany({
      where: user.role === "DEV" ? {} : { createdBy: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async create(user: AuthenticatedUser, data: CreateImportBatchData) {
    const errorCount = data.issues.filter((issue) => issue.severity === "ERROR").length;
    const batch = await this.db.importBatch.create({
      data: {
        type: data.type,
        status: "VALIDATED",
        fileName: data.fileName,
        fileSize: data.fileSize,
        checksum: data.checksum,
        acceptedCount: data.rows.length - errorCount,
        rejectedCount: errorCount,
        createdBy: user.id,
        rows: {
          create: data.rows.map((row) => ({
            rowNumber: row.rowNumber,
            raw: toJson(row.raw),
            mapped: toJson(row.mapped)
          }))
        },
        issues: {
          create: data.issues.map((issue) => ({
            rowNumber: issue.rowNumber ?? null,
            field: issue.field ?? null,
            value: issue.value ?? null,
            code: issue.code,
            severity: issue.severity,
            message: issue.message
          }))
        }
      },
      include: {
        rows: true,
        issues: true
      }
    });

    await this.db.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action: "CREATE",
        entity: "ImportBatch",
        entityId: batch.id,
        after: toJson({
          type: batch.type,
          fileName: batch.fileName,
          checksum: batch.checksum,
          acceptedCount: batch.acceptedCount,
          rejectedCount: batch.rejectedCount
        }),
        origin: "api"
      }
    });

    return batch;
  }

  async get(id: string, user: AuthenticatedUser) {
    const batch = await this.db.importBatch.findUnique({
      where: { id },
      include: {
        rows: true,
        issues: true
      }
    });

    if (!batch) {
      throw new HttpError(404, "IMPORT_NOT_FOUND", "Importacao nao encontrada.");
    }

    if (user.role !== "DEV" && batch.createdBy !== user.id) throw new HttpError(403,"SCOPE_FORBIDDEN","Importação de outro usuário.");
    return batch;
  }

  async issues(id: string, user: AuthenticatedUser) {
    await this.get(id, user);
    return this.db.importIssue.findMany({
      where: { batchId: id },
      orderBy: [{ severity: "asc" }, { rowNumber: "asc" }]
    });
  }

  async commit(user: AuthenticatedUser, id: string) {
    const batch = await this.get(id, user); assertCanImport(user, batch.type);
    if (batch.status === "COMMITTED") return {ok:true,committedRows:batch.acceptedCount};
    if (batch.issues.some(issue => issue.severity === "ERROR")) throw new HttpError(409,"IMPORT_HAS_ERRORS","Corrija as linhas rejeitadas antes de confirmar.");
    if (batch.type !== "EMPLOYEES") throw new HttpError(409,"IMPORT_TYPE_NOT_READY","Este importador efetiva somente colaboradores; QLP e escala devem ser criados pelos respectivos fluxos.");
    const inputs = batch.rows.map(row => employeeInputSchema.parse(row.mapped));
    for (const input of inputs) {
      await scopedOperation(this.db,user,input.operationId);
      if (input.functionId) {
        const fn = await this.db.jobFunction.findUnique({where:{id:input.functionId}});
        if (!fn || (fn.operationId && fn.operationId !== input.operationId)) throw new HttpError(409,"UNKNOWN_FUNCTION","Função inválida para a operação.");
      }
    }
    return this.db.$transaction(async tx => {
      const claimed = await tx.importBatch.updateMany({where:{id,status:"VALIDATED"},data:{status:"COMMITTED",updatedBy:user.id}});
      if (!claimed.count) throw new HttpError(409,"IMPORT_STATE_CONFLICT","Lote já processado ou alterado.");
      for (const input of inputs) await tx.employee.create({data:{
        operationId:input.operationId,functionId:input.functionId ?? null,name:input.name,identifier:input.identifier,
        admissionDate:input.admissionDate ? new Date(input.admissionDate) : null,status:input.status,
        employmentType:input.employmentType ?? null,jobTitle:input.jobTitle ?? null,workRegime:input.workRegime ?? null,
        shift:input.shift ?? null,team:input.team ?? null,notes:input.notes ?? null,createdBy:user.id,
        history:{create:{action:"IMPORT_COMMIT",after:toJson({batchId:id}),createdBy:user.id}}
      }});
      await tx.auditLog.create({data:{userId:user.id,userRole:user.role,action:"CREATE",entity:"ImportBatch",entityId:id,after:toJson({action:"IMPORT_COMMIT",count:inputs.length}),origin:"api"}});
      return {ok:true,committedRows:inputs.length};
    },{isolationLevel:"Serializable"});
  }

}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
