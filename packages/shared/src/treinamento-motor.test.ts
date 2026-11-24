// O motor de regras dos Treinamentos Interativos, com os dois cenários de EXEMPLO como fixtures.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluate,
  reacaoDaAlternativa,
  takenFromPicks,
  TreinoErroDoMotor,
  visaoDoParticipante
} from "./treinamento-motor.js";
import { treinoCenarioSchema, type TreinoCenario } from "./treinamento-schema.js";

const carregar = (nome: string): TreinoCenario =>
  treinoCenarioSchema.parse(
    JSON.parse(
      readFileSync(new URL(`./treinamentos/exemplos/${nome}.json`, import.meta.url), "utf8")
    )
  );
const quadro = carregar("manutencao-quadro-uti");
const plantao = carregar("rh-falta-plantao-noturno");

/** Todas as decisões com o mesmo valor, menos as listadas em `exceto`. */
function decisoes(cenario: TreinoCenario, valor: boolean, exceto: string[] = []) {
  return Object.fromEntries(
    cenario.decisions.map((d) => [d.id, exceto.includes(d.id) ? !valor : valor])
  );
}
const niveis = (cenario: TreinoCenario, d: Record<string, boolean>) =>
  Object.fromEntries(evaluate(cenario, d).outcomes.map((o) => [o.id, o.nivel]));
const ocorridos = (cenario: TreinoCenario, d: Record<string, boolean>) =>
  evaluate(cenario, d)
    .events.filter((e) => e.aconteceu)
    .map((e) => e.id);

describe("motor — Quadro elétrico da UTI (EXEMPLO)", () => {
  it("tudo certo: ok/ok/ok, desligamento seguro e sem arco", () => {
    expect(niveis(quadro, decisoes(quadro, true))).toEqual({
      tecnico: "ok",
      uti: "ok",
      conformidade: "ok"
    });
    expect(ocorridos(quadro, decisoes(quadro, true))).toEqual([
      "uti_preparada",
      "desligamento_seguro"
    ]);
  });

  it("tudo errado: bad/bad/bad, com arco e lesão", () => {
    expect(niveis(quadro, decisoes(quadro, false))).toEqual({
      tecnico: "bad",
      uti: "bad",
      conformidade: "bad"
    });
    expect(ocorridos(quadro, decisoes(quadro, false))).toEqual([
      "arco",
      "lesao",
      "uti_surpresa",
      "sem_registro"
    ]);
  });

  it("tudo certo exceto medir: o arco acontece e o EPI o contém (técnico em atenção)", () => {
    const d = decisoes(quadro, true, ["medir"]);
    expect(ocorridos(quadro, d)).toEqual(["arco", "arco_contido", "uti_preparada"]);
    expect(niveis(quadro, d)).toEqual({ tecnico: "warn", uti: "warn", conformidade: "warn" });
  });

  it("sem bloqueio e sem EPI: arco com lesão, mesmo com a UTI avisada", () => {
    const d = decisoes(quadro, true, ["bloqueio", "epi"]);
    expect(niveis(quadro, d).tecnico).toBe("bad");
    expect(niveis(quadro, d).uti).toBe("warn");
  });

  it("explica as causas: o arco por falta de medição, a lesão pelo arco sem EPI", () => {
    const desfecho = evaluate(quadro, decisoes(quadro, true, ["medir", "epi"]));
    const arco = desfecho.events.find((e) => e.id === "arco")!;
    expect(arco.causas).toEqual([{ decision: "medir", is: false, valeu: true }]);
    const lesao = desfecho.events.find((e) => e.id === "lesao")!;
    expect(lesao.causas).toEqual([
      { event: "arco", is: true, valeu: true },
      { decision: "epi", is: false, valeu: true }
    ]);
    const tecnico = desfecho.outcomes.find((o) => o.id === "tecnico")!;
    expect(tecnico).toMatchObject({ nivel: "bad", texto: "Lesão grave" });
  });

  it("é determinístico: as mesmas decisões dão sempre o mesmo desfecho", () => {
    const d = decisoes(quadro, true, ["apr", "medir"]);
    const primeiro = JSON.stringify(evaluate(quadro, d));
    for (let i = 0; i < 20; i++) expect(JSON.stringify(evaluate(quadro, { ...d }))).toBe(primeiro);
  });
});

describe("motor — Falta no plantão noturno (EXEMPLO)", () => {
  it("tudo certo: ok/ok/ok; tudo errado: bad/bad/bad", () => {
    expect(niveis(plantao, decisoes(plantao, true))).toEqual({
      cobertura: "ok",
      conformidade: "ok",
      transparencia: "ok"
    });
    expect(niveis(plantao, decisoes(plantao, false))).toEqual({
      cobertura: "bad",
      conformidade: "bad",
      transparencia: "bad"
    });
  });

  it("sem registrar a troca: escala desatualizada deixa o turno sem cobertura clara", () => {
    const d = decisoes(plantao, true, ["registro"]);
    expect(ocorridos(plantao, d)).toEqual(["escala_desatualizada", "cobertura_duvidosa"]);
    expect(niveis(plantao, d)).toEqual({
      cobertura: "bad",
      conformidade: "warn",
      transparencia: "warn"
    });
  });

  it("sem respeitar o descanso: escala fora das regras, plantão coberto com ressalvas", () => {
    const d = decisoes(plantao, true, ["interjornada"]);
    expect(niveis(plantao, d)).toEqual({
      cobertura: "warn",
      conformidade: "bad",
      transparencia: "ok"
    });
  });
});

describe("motor — alternativas, reação e o que o participante vê", () => {
  const indice = (cenario: TreinoCenario, cumpre: boolean) =>
    Object.fromEntries(
      cenario.questions.map((q) => [q.id, q.alternatives.findIndex((a) => a.taken === cumpre)])
    );

  it("takenFromPicks converte as escolhas nas decisões que elas cumprem", () => {
    expect(takenFromPicks(quadro, indice(quadro, true))).toEqual(decisoes(quadro, true));
    expect(takenFromPicks(plantao, indice(plantao, false))).toEqual(decisoes(plantao, false));
  });

  it("recusa respostas faltando, alternativa fora da faixa e decisões incompletas", () => {
    const picks = indice(quadro, true);
    delete picks.q3;
    expect(() => takenFromPicks(quadro, picks)).toThrow(TreinoErroDoMotor);
    expect(() => takenFromPicks(quadro, { ...indice(quadro, true), q1: 4 })).toThrow(/não existe/);
    expect(() => takenFromPicks(quadro, { ...indice(quadro, true), q1: 1.5 })).toThrow(
      /não existe/
    );
    const incompletas: Record<string, boolean> = { ...decisoes(quadro, true) };
    delete incompletas.medir;
    expect(() => evaluate(quadro, incompletas)).toThrow(/Faltam decisões: medir/);
  });

  it("a reação é a da alternativa escolhida", () => {
    expect(reacaoDaAlternativa(quadro, "q4", 2)).toMatchObject({
      tone: "warn",
      title: "Vigia não é bloqueio",
      scene: { lock: "0" }
    });
    expect(() => reacaoDaAlternativa(quadro, "q9", 0)).toThrow(TreinoErroDoMotor);
  });

  it("a visão do participante não leva o gabarito nem as regras", () => {
    for (const cenario of [quadro, plantao]) {
      const texto = JSON.stringify(visaoDoParticipante(cenario));
      for (const proibido of [
        '"taken"',
        '"beat"',
        '"tone"',
        '"decision"',
        '"procedure"',
        '"events"',
        '"outcomes"',
        '"when"'
      ])
        expect(texto, proibido).not.toContain(proibido);
      const visao = visaoDoParticipante(cenario);
      expect(visao.questions).toHaveLength(5);
      expect(visao.questions[0]?.alternatives.map((a) => a.indice)).toEqual([0, 1, 2, 3]);
      expect(visao.exemplo).toBe(true);
    }
  });
});
