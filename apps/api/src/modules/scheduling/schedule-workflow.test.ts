import { defaultRolePermissions } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { canTransitionSchedule } from "./schedule-workflow.js";

const admin = defaultRolePermissions.ADMIN;
const rh = defaultRolePermissions.RH;
const approver = defaultRolePermissions.APPROVER;

describe("canTransitionSchedule", () => {
  it("administrador aprova e publica em sequência", () => {
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", admin)).toBe(true);
    expect(canTransitionSchedule("APPROVED", "PUBLISHED", admin)).toBe(true);
  });

  it("RH envia e publica a aprovada, mas não aprova", () => {
    expect(canTransitionSchedule("DRAFT", "IN_REVIEW", rh)).toBe(true);
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", rh)).toBe(false);
    expect(canTransitionSchedule("APPROVED", "PUBLISHED", rh)).toBe(true);
  });

  it("RH não publica escala em rascunho nem pendente de aprovação (publicar exige aprovada)", () => {
    expect(canTransitionSchedule("DRAFT", "PUBLISHED", rh)).toBe(false);
    expect(canTransitionSchedule("IN_REVIEW", "PUBLISHED", rh)).toBe(false);
  });

  it("Aprovador aprova, mas não envia, não publica e não exclui", () => {
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", approver)).toBe(true);
    expect(canTransitionSchedule("DRAFT", "IN_REVIEW", approver)).toBe(false);
    expect(canTransitionSchedule("APPROVED", "PUBLISHED", approver)).toBe(false);
    expect(canTransitionSchedule("DRAFT", "ARCHIVED", approver)).toBe(false);
  });

  it("não existe publicação que pule a aprovação, nem para administradores (o override de DEV foi removido)", () => {
    expect(canTransitionSchedule("DRAFT", "PUBLISHED", defaultRolePermissions.DEV)).toBe(false);
    expect(canTransitionSchedule("DRAFT", "PUBLISHED", admin)).toBe(false);
  });

  it("escala publicada só pode ser arquivada, por quem tem essa permissão", () => {
    expect(canTransitionSchedule("PUBLISHED", "DRAFT", admin)).toBe(false);
    expect(canTransitionSchedule("PUBLISHED", "ARCHIVED", admin)).toBe(true);
    expect(canTransitionSchedule("PUBLISHED", "ARCHIVED", approver)).toBe(false);
  });

  it("o nome do perfil não vale: sem a permissão, nada é permitido", () => {
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", [])).toBe(false);
  });
});
