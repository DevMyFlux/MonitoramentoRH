import type { AuthenticatedUser } from "@my-flux/types";
import { HttpError } from "../../lib/http-error.js";
import { can } from "../identity/authorization.js";
import type { ImportType } from "./import-parser.js";

/** `imports:run` importa qualquer base; `imports:employees` só a de colaboradores. */
export function canImport(user: Pick<AuthenticatedUser, "permissions">, type: ImportType): boolean {
  return can(user, "imports:run") || (type === "EMPLOYEES" && can(user, "imports:employees"));
}

export function assertCanImport(user: AuthenticatedUser, type: ImportType): void {
  if (canImport(user, type)) return;

  throw new HttpError(
    403,
    "PERMISSION_DENIED",
    type === "EMPLOYEES"
      ? "Seu perfil não tem permissão para importar colaboradores."
      : "Seu perfil não tem permissão para importar este tipo de base.",
    { permission: type === "EMPLOYEES" ? "imports:employees" : "imports:run" }
  );
}
