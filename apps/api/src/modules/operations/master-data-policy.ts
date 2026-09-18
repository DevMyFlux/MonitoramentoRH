import type { AuthenticatedUser } from "@my-flux/types";
import { HttpError } from "../../lib/http-error.js";

export function assertCanManageMasterData(user: AuthenticatedUser): void {
  if (user.role !== "DEV" && user.role !== "ADMIN") {
    throw new HttpError(403, "FORBIDDEN", "Usuario sem permissao para administrar cadastros.");
  }
}
