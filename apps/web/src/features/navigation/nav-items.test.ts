import { describe, expect, it } from "vitest";
import { navigationGroups } from "./nav-items";

describe("navigation groups", () => {
  it("exposes the MY FLUX operational modules", () => {
    const labels = navigationGroups.flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toContain("Dashboard");
    expect(labels).toContain("QLP");
    expect(labels).toContain("Colaboradores");
    expect(labels).toContain("Escalas");
    expect(labels).toContain("Auditoria");
    expect(labels).toContain("Parâmetros");
  });
});
