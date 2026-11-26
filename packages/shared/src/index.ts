export * from "./acessos.js";
export * from "./conta.js";
export * from "./holidays.js";
export * from "./modules.js";
export * from "./leadership-lab.js";
export * from "./leadership-lab-acesso.js";
export * from "./leadership-lab-api.js";
export * from "./leadership-lab-cadastro-api.js";
export * from "./leadership-lab-acompanhamento-api.js";
export * from "./leadership-lab-curadoria-api.js";
export * from "./leadership-lab-notificacoes-api.js";
export * from "./leadership-lab-simulador-api.js";
export * from "./leadership-lab-calculos.js";
export * from "./leadership-lab-pedagogia.js";
export * from "./parity-rotation.js";
export * from "./schedule-codes.js";
export * from "./schedule-templates.js";
export * from "./shift-pattern.js";
export * from "./suporte-api.js";
export * from "./treinamento-schema.js";
export * from "./treinamento-motor.js";
export * from "./treinamento-importacao.js";
export * from "./leadership-lab-teste.js";
export * from "./leadership-lab-teste-api.js";
export * from "./treinamentos-acesso.js";
export * from "./treinamentos-api.js";

export const roleRank = {
  DEV: 4,
  ADMIN: 3,
  RH: 2,
  COMUM: 1
} as const;

export type RankedRole = keyof typeof roleRank;

export function isRoleAtLeast(role: RankedRole, minimum: RankedRole): boolean {
  return roleRank[role] >= roleRank[minimum];
}
