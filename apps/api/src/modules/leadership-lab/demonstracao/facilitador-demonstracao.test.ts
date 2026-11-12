import { describe, expect, it } from "vitest";
import type { ConversaIaRequest } from "../ia/ia-contrato.js";
import { responderComoFacilitador } from "./facilitador-demonstracao.js";

function pedido(
  mensagem: string,
  extra: Partial<ConversaIaRequest["resultado"]> = {}
): ConversaIaRequest {
  return {
    modo: "debriefing",
    contexto: null,
    molde: "supervisor",
    mensagem,
    historico: [],
    resultado: {
      resumo: "Você conduziu o turno com atenção.",
      ponto_forte: "Comunicação.",
      ponto_desenvolvimento: "Delegação.",
      sugestoes: ["Registre o aviso.", "Pratique a delegação."],
      skills: [
        { skill: "gestao-os", nivel: 4 },
        { skill: "delegacao", nivel: 2 }
      ],
      situacoes: [1, 2, 3].map((numero) => ({
        numero,
        marco: numero === 3,
        texto: `Cenário ${numero}.`,
        opcoes: [
          { id: "A" as const, texto: "Reunir a equipe." },
          { id: "B" as const, texto: "Resolver sozinho." },
          { id: "C" as const, texto: "Esperar." }
        ],
        escolha: numero === 2 ? null : ("A" as const),
        tempo_esgotado: numero === 2,
        justificativa: `Avaliação ${numero}.`
      })),
      ...extra
    }
  };
}

describe("facilitador de demonstração", () => {
  it("fala só do que está no resultado", () => {
    expect(responderComoFacilitador(pedido("Qual foi meu ponto forte?"))).toContain("Comunicação.");
    expect(responderComoFacilitador(pedido("O que preciso melhorar?"))).toContain("Delegação.");
    expect(responderComoFacilitador(pedido("Me dê sugestões"))).toContain("• Registre o aviso.");
    expect(responderComoFacilitador(pedido("Como fui no geral?"))).toBe(
      "Você conduziu o turno com atenção."
    );
  });

  it("lista os níveis com o nome da skill", () => {
    const r = responderComoFacilitador(pedido("Quais meus níveis por skill?"));
    expect(r).toContain("Gestão de OS e prioridades: 4/5");
    expect(r).toContain("Delegação e desenvolvimento do time: 2/5");
  });

  it("explica uma situação: a escolha e a avaliação; omissão como omissão", () => {
    const um = responderComoFacilitador(pedido("O que aconteceu na situação 1?"));
    expect(um).toContain("Você escolheu a opção A");
    expect(um).toContain("Avaliação 1.");
    expect(responderComoFacilitador(pedido("e na situação 2"))).toContain("contou como omissão");
    expect(responderComoFacilitador(pedido("Fale do marco"))).toContain(
      "Situação 3 (o marco do teste)"
    );
  });

  it("situação que não existe: diz o intervalo, sem inventar", () => {
    expect(responderComoFacilitador(pedido("situação 9"))).toContain("de 1 a 3");
  });

  it("o que não entende, responde com o que sabe fazer", () => {
    expect(responderComoFacilitador(pedido("qual a capital da França?"))).toContain(
      "Posso comentar"
    );
  });

  it("não inventa o que o resultado não tem", () => {
    const r = pedido("ponto forte", { ponto_forte: null });
    expect(responderComoFacilitador(r)).toContain("não destacou um ponto forte");
  });
});
