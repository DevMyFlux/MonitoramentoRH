import type { UserScope } from "@my-flux/types";

type ScopedResource = {
  companyId?: string | null;
  operationId?: string | null;
  unitId?: string | null;
};

export function canAccessScope(scopes: UserScope[], resource: ScopedResource): boolean {
  return scopes.some((scope) => {
    if (scope.isGlobal) {
      return true;
    }

    if (!scope.companyId && !scope.operationId && !scope.unitId) return false;
    return (!scope.companyId || scope.companyId === resource.companyId) &&
      (!scope.operationId || scope.operationId === resource.operationId) &&
      (!scope.unitId || scope.unitId === resource.unitId);
  });
}
