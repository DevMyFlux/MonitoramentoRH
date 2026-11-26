// As validações de autoria do cenário: o que entra e, principalmente, o que é recusado (com o
// caminho do problema, para a tela de autoria apontar o lugar exato).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validarCenario } from "./treinamento-schema.js";

const bruto = (nome: string) =>
  JSON.parse(
    readFileSync(new URL(`./treinamentos/exemplos/${nome}.json`, import.meta.url), "utf8")
  ) as Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;
const copia = () => structuredClone(bruto("manutencao-quadro-uti"));

function problemas(entrada: unknown) {
  const resultado = validarCenario(entrada);
  if (resultado.ok) throw new Error("Era para recusar o cenário.");
  return resultado.problemas;
}

describe("validação de autoria do cenário", () => {
  it("aceita os dois cenários de exemplo, marcados como EXEMPLO", () => {
    for (const nome of ["manutencao-quadro-uti", "rh-falta-plantao-noturno"]) {
      const resultado = validarCenario(bruto(nome));
      expect(resultado.ok, nome).toBe(true);
      if (resultado.ok) expect(resultado.cenario.exemplo).toBe(true);
    }
  });

  it("recusa acontecimento que cita um acontecimento posterior", () => {
    const c = copia();
    // "arco" passa a depender de "lesao", que vem depois dele.
    c.events[0].when = { all: [{ event: "lesao", is: false }] };
    expect(problemas(c)).toContainEqual({
      caminho: "events.0.when.all.0.event",
      mensagem: 'O acontecimento "lesao" não existe ou vem depois deste.'
    });
  });

  it("recusa pergunta em que toda alternativa cumpre a decisão (nenhuma falha)", () => {
    const c = copia();
    for (const alternativa of c.questions[1].alternatives) {
      alternativa.taken = true;
      alternativa.beat.tone = "good";
    }
    expect(problemas(c)).toContainEqual({
      caminho: "questions.1.alternatives",
      mensagem: "Toda alternativa cumpre a decisão; ao menos uma deve falhar."
    });
  });

  it("recusa pergunta sem nenhuma alternativa que cumpra a decisão", () => {
    const c = copia();
    for (const alternativa of c.questions[0].alternatives) {
      alternativa.taken = false;
      alternativa.beat.tone = "bad";
    }
    expect(problemas(c).map((p) => p.mensagem)).toContain("Nenhuma alternativa cumpre a decisão.");
  });

  it("recusa tom incoerente com o que a alternativa cumpre", () => {
    const c = copia();
    c.questions[3].alternatives[1].beat.tone = "bad"; // cumpre, mas tom ruim
    c.questions[3].alternatives[0].beat.tone = "good"; // não cumpre, mas tom bom
    expect(problemas(c)).toEqual(
      expect.arrayContaining([
        {
          caminho: "questions.3.alternatives.1.beat.tone",
          mensagem: "Alternativa que cumpre a decisão não pode ter tom 'bad'."
        },
        {
          caminho: "questions.3.alternatives.0.beat.tone",
          mensagem: "Alternativa que não cumpre a decisão não pode ter tom 'good'."
        }
      ])
    );
  });

  it("recusa decisão sem pergunta (e a pergunta que aponta para decisão inexistente)", () => {
    const c = copia();
    c.questions[4].decision = "bloqueio"; // "medir" fica sem pergunta; "bloqueio", com duas
    const lista = problemas(c).map((p) => p.mensagem);
    expect(lista).toContain('A decisão "medir" não tem pergunta.');
    expect(lista).toContain('A decisão "bloqueio" tem 2 perguntas; deve ter uma.');

    const d = copia();
    d.questions[4].decision = "inventada";
    expect(problemas(d)).toContainEqual({
      caminho: "questions.4.decision",
      mensagem: 'Decisão inexistente: "inventada".'
    });
  });

  it("recusa regra que cita decisão inexistente, ids repetidos e regra vazia", () => {
    const c = copia();
    c.outcomes[0].when.ok = { all: [{ decision: "voar", is: true }] };
    c.events[2].id = "arco";
    const lista = problemas(c);
    expect(lista).toContainEqual({
      caminho: "outcomes.0.when.ok.all.0.decision",
      mensagem: 'Decisão inexistente: "voar".'
    });
    expect(lista).toContainEqual({ caminho: "events.2.id", mensagem: 'Id repetido: "arco".' });

    const d = copia();
    d.events[0].when = {};
    expect(problemas(d).map((p) => p.caminho)).toContain("events.0.when");
  });

  it("recusa formato fora do contrato: quantidade de perguntas e alternativas, rótulo de tempo longo demais, campo a mais", () => {
    const c = copia();
    c.questions.pop();
    expect(problemas(c).map((p) => p.caminho)).toContain("questions");

    const d = copia();
    d.questions[0].alternatives.pop();
    expect(problemas(d).map((p) => p.caminho)).toContain("questions.0.alternatives");

    const e = copia();
    e.questions[0].time = "x".repeat(25); // o rótulo de tempo é texto curto (até 24)
    expect(problemas(e).map((p) => p.caminho)).toContain("questions.0.time");

    const f = copia();
    f.questions[0].gabarito = 1;
    expect(problemas(f).map((p) => p.caminho)).toContain("questions.0");
  });
});
