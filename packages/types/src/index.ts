export type Role = "DEV" | "ADMIN" | "RH" | "APPROVER" | "COMUM";

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
  /** Códigos `recurso:ação` concedidos ao perfil no banco. A autorização depende disto, não do nome do perfil. */
  permissions: string[];
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
