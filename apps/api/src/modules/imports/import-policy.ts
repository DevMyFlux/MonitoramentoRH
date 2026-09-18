import type { AuthenticatedUser } from "@my-flux/types";
import { HttpError } from "../../lib/http-error.js";
import type { ImportType } from "./import-parser.js";

export function assertCanImport(user: AuthenticatedUser, type: ImportType): void {
  if (user.role === "DEV" || user.role === "ADMIN") {
    return;
  }

  if (user.role === "RH" && type === "EMPLOYEES") {
    return;
  }

  throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para importar este tipo de base.");
}
