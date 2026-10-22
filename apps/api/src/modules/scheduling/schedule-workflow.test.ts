import { defaultRolePermissions } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { canTransitionSchedule, isEditableInPlace } from "./schedule-workflow.js";

const admin = defaultRolePermissions.ADMIN;
const rh = defaultRolePermissions.RH;
const approver = defaultRolePermissions.APPROVER;

describe("canTransitionSchedule", () => {
  it("administrador percorre o fluxo inteiro", () => {
    expect(canTransitionSchedule("DRAFT", "IN_REVIEW", admin)).toBe(true);
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", admin)).toBe(true);
    expect(canTransitionSchedule("IN_REVIEW", "REJECTED", admin)).toBe(true);
    expect(canTransitionSchedule("APPROVED", "PUBLISHED", admin)).toBe(true);
  });

  it("RH envia (e reenvia a reprovada) e publica a aprovada, mas não aprova nem reprova", () => {
    expect(canTransitionSchedule("DRAFT", "IN_REVIEW", rh)).toBe(true);
    expect(canTransitionSchedule("REJECTED", "IN_REVIEW", rh)).toBe(true);
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", rh)).toBe(false);
    expect(canTransitionSchedule("IN_REVIEW", "REJECTED", rh)).toBe(false);
    expect(canTransitionSchedule("APPROVED", "PUBLISHED", rh)).toBe(true);
  });

  it("RH não publica escala em rascunho, pendente de aprovação ou reprovada", () => {
    for (const current of ["DRAFT", "IN_REVIEW", "REJECTED"] as const) {
      expect(canTransitionSchedule(current, "PUBLISHED", rh), current).toBe(false);
    }
  });

  it("Aprovador aprova e reprova, mas não envia, não publica e não exclui", () => {
    expect(canTransitionSchedule("IN_REVIEW", "APPROVED", approver)).toBe(true);
    expect(canTransitionSchedule("IN_REVIEW", "REJECTED", approver)).toBe(true);
    expect(canTransitionSchedule("DRAFT", "IN_REVIEW", approver)).toBe(false);
    expect(canTransitionSchedule("REJECTED", "IN_REVIEW", approver)).toBe(false);
    expect(canTransitionSchedule("APPROVED", "PUBLISHED", approver)).toBe(false);
    expect(canTransitionSchedule("DRAFT", "ARCHIVED", approver)).toBe(false);
  });

  it("só se aprova ou reprova o que está em análise", () => {
    for (const current of ["DRAFT", "REJECTED", "APPROVED", "PUBLISHED"] as const) {
      expect(canTransitionSchedule(current, "APPROVED", admin), `${current}->APPROVED`).toBe(false);
      expect(canTransitionSchedule(current, "REJECTED", admin), `${current}->REJECTED`).toBe(false);
    }
  });

  it("não existe publicação que pule a aprovação, nem para administradores (o override de DEV foi removido)", () => {
    for (const current of ["DRAFT", "IN_REVIEW", "REJECTED"] as const) {
      expect(canTransitionSchedule(current, "PUBLISHED", defaultRolePermissions.DEV), current).toBe(
        false
      );
    }
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

describe("isEditableInPlace", () => {
  it("só rascunho e reprovada se editam na própria versão; o resto gera nova versão", () => {
    expect(isEditableInPlace("DRAFT")).toBe(true);
    expect(isEditableInPlace("REJECTED")).toBe(true);
    for (const status of ["IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"] as const) {
      expect(isEditableInPlace(status), status).toBe(false);
    }
  });
});
