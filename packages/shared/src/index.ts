export * from "./schedule-codes.js";
export * from "./schedule-templates.js";

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
