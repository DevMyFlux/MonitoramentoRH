import { describe, expect, it } from "vitest";
import { MAX_SKILLS_NO_RESUMO, dificuldadeSugerida, resumirHistorico } from "./perfil-resumido.js";

const linha = (
  skillId: string,
  nivel: number,
  sessaoId: string,
  extra: { validado?: boolean; nivelValidado?: number | null } = {}
) => ({
  skillId,
  nivel,
  nivelValidado: extra.nivelValidado ?? null,
  validado: extra.validado ?? true,
  sessaoId
});

describe("resumirHistorico", () => {
  it("sem histórico: nada a resumir, dificuldade base", () => {
    expect(resumirHistorico("supervisor", [])).toEqual({
      testesConsiderados: 0,
      testesProvisorios: 0,
      skills: [],
      dificuldadeSugerida: 1
    });
  });

  it("usa o nível validado pelo RH quando houver, e marca o provisório", () => {
    const r = resumirHistorico("supervisor", [
      linha("gestao-os", 3, "t1", { validado: true, nivelValidado: 4 }),
      linha("delegacao", 2, "t2", { validado: false })
    ]);
    const os = r.skills.find((s) => s.skill === "gestao-os")!;
    expect(os).toMatchObject({ nivel: 4, provisorio: false });
    expect(r.skills.find((s) => s.skill === "delegacao")).toMatchObject({
      nivel: 2,
      provisorio: true
    });
    expect(r.testesConsiderados).toBe(2);
    expect(r.testesProvisorios).toBe(1);
  });

  it("descreve a evolução entre testes", () => {
    const r = resumirHistorico("supervisor", [
      linha("gestao-os", 2, "t1"),
      linha("gestao-os", 4, "t2"),
      linha("delegacao", 4, "t1"),
      linha("delegacao", 2, "t2"),
      linha("gestao-equipe", 3, "t1"),
      linha("gestao-equipe", 3, "t2"),
      linha("decisao-pressao", 3, "t2")
    ]);
    const t = (s: string) => r.skills.find((x) => x.skill === s)?.tendencia;
    expect(t("gestao-os")).toBe("subindo");
    expect(t("delegacao")).toBe("caindo");
    expect(t("gestao-equipe")).toBe("estavel");
    expect(t("decisao-pressao")).toBe("sem_base");
  });

  it("erro recorrente: nível baixo nos dois últimos testes, ou escolhas fracas repetidas", () => {
    const r = resumirHistorico(
      "supervisor",
      [
        linha("delegacao", 2, "t1"),
        linha("delegacao", 2, "t2"),
        linha("gestao-os", 4, "t1"),
        linha("gestao-os", 4, "t2"),
        linha("materiais-custos", 3, "t2")
      ],
      new Map([
        ["gestao-os", 2],
        ["materiais-custos", 1]
      ])
    );
    const rec = (s: string) => r.skills.find((x) => x.skill === s)!.recorrente;
    expect(rec("delegacao")).toBe(true);
    expect(rec("gestao-os")).toBe(true); // forte no nível, mas 2 escolhas fracas
    expect(rec("materiais-custos")).toBe(false);
  });

  it("manda só o que é relevante: as mais fracas primeiro, mais a mais forte, no máximo 5", () => {
    const skills = [
      "aplicacao-nr-pop",
      "gestao-os",
      "contingencia",
      "materiais-custos",
      "comunicacao-cliente",
      "gestao-equipe",
      "decisao-pressao",
      "delegacao"
    ];
    const niveis = [5, 1, 3, 2, 4, 3, 2, 5];
    const r = resumirHistorico(
      "supervisor",
      skills.map((s, i) => linha(s, niveis[i]!, "t1"))
    );
    expect(r.skills).toHaveLength(MAX_SKILLS_NO_RESUMO);
    expect(r.skills[0]!.skill).toBe("gestao-os"); // a mais fraca
    const ultimo = r.skills.at(-1)!;
    expect(ultimo.nivel).toBe(5); // a mais forte fecha o resumo
  });

  it("ignora skill que não é do piloto", () => {
    expect(resumirHistorico("supervisor", [linha("inventada", 1, "t1")]).skills).toEqual([]);
  });

  it("a dificuldade acompanha o domínio das skills de foco DO CARGO", () => {
    // gestao-os é foco de supervisor; aplicacao-nr-pop não é.
    const forteNoFoco = resumirHistorico("supervisor", [
      linha("gestao-os", 5, "t1"),
      linha("aplicacao-nr-pop", 1, "t1")
    ]);
    expect(forteNoFoco.dificuldadeSugerida).toBe(3);
    const fraco = resumirHistorico("supervisor", [linha("gestao-os", 2, "t1")]);
    expect(fraco.dificuldadeSugerida).toBe(1);
  });
});

describe("dificuldadeSugerida", () => {
  it("1 sem base ou abaixo de 2,5; 2 até 3,7; 3 de 3,8 em diante", () => {
    expect(dificuldadeSugerida([])).toBe(1);
    expect(dificuldadeSugerida([2, 2])).toBe(1);
    expect(dificuldadeSugerida([3, 3])).toBe(2);
    expect(dificuldadeSugerida([4, 4])).toBe(3);
  });
});
