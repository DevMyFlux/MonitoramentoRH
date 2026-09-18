export type Role = "DEV" | "ADMIN" | "RH" | "COMUM";

export type UserScope = {
  companyId?: string | null;
  operationId?: string | null;
  unitId?: string | null;
  isGlobal: boolean;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  scopes: UserScope[];
};

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiSuccess<TData> = {
  data: TData;
};

export type HealthStatus = {
  service: "my-flux-api";
  status: "ok";
  version: string;
};
