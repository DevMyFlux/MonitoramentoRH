export type Role = "DEV" | "ADMIN" | "RH" | "COMUM";

export type UserScope = {
  companyId?: string | null;
  operationId?: string | null;
  unitId?: string | null;
  isGlobal: boolean;
};

export type NivelGovernanca = "assistente" | "supervisor" | "coordenador" | "diretoria";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  scopes: UserScope[];
  /** Cadastro da conta (podem faltar em contas antigas: veja cadastroIncompleto em shared). */
  cargo?: string | null;
  nivelGovernanca?: NivelGovernanca | null;
  area?: { id: string; nome: string } | null;
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
