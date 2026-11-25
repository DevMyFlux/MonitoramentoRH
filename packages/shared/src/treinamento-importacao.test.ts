// Os 40 cenários do Leadership Lab (docs/cenarios-lab): importação, validação e o gabarito.
// Lê os arquivos reais (as fixtures), não cópias: se alguém mexer num cenário e quebrar uma regra, o
// teste acusa o arquivo e o caminho.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ESCRITORIO_GESTAO,
  adaptarCenarioDoPacote,
  validarCenarioImportado
} from "./treinamento-importacao.js";
import { evaluate, takenFromPicks, visaoDoParticipante } from "./treinamento-motor.js";
import { treinoPublicos, type TreinoCenario } from "./treinamento-schema.js";

const PASTA = resolve(process.cwd(), "../../docs/cenarios-lab");
const arquivos = readdirSync(PASTA)
  .filter((nome) => nome.endsWith(".json") && nome !== "_indice.json")
  .sort();
const lerBruto = (nome: string) =>
  JSON.parse(readFileSync(resolve(PASTA, nome), "utf8")) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function importar(nome: string): TreinoCenario {
  const resultado = validarCenarioImportado(lerBruto(nome));
  if (!resultado.ok)
    throw new Error(
      `${nome}: ${resultado.problemas.map((p) => `${p.caminho}: ${p.mensagem}`).join(" | ")}`
    );
  return resultado.cenario;
}

describe("os 40 cenários do Lab (fixtures em docs/cenarios-lab)", () => {
  it("são 40 arquivos, 10 por público, e o índice lista exatamente os mesmos", () => {
    expect(arquivos).toHaveLength(40);
    const indice = JSON.parse(readFileSync(resolve(PASTA, "_indice.json"), "utf8")) as {
      arquivo: string;
      id: string;
      publico: string;
      status: string;
    }[];
    expect(indice.map((i) => i.arquivo).sort()).toEqual(arquivos);
    for (const publico of treinoPublicos)
      expect(
        indice.filter((i) => i.publico === publico),
        publico
      ).toHaveLength(10);
    // Tudo entra como rascunho: só a área responsável aprova.
    expect(new Set(indice.map((i) => i.status))).toEqual(new Set(["rascunho"]));
    for (const item of indice) expect(lerBruto(item.arquivo).id).toBe(item.id);
  });

  it("todos passam no validador de autoria do projeto, com o mesmo id como slug", () => {
    const slugs = new Set<string>();
    for (const nome of arquivos) {
      const cenario = importar(nome);
      expect(cenario.slug).toBe(lerBruto(nome).id);
      expect(cenario.scenePack).toBe(ESCRITORIO_GESTAO.id);
      expect(cenario.publico, nome).toBeDefined();
      expect(cenario.exemplo).toBe(true);
      slugs.add(cenario.slug);
    }
    expect(slugs.size).toBe(40);
  });

  it("ordem das decisões: comunicar, duas verificações, registrar e confirmar (5 decisões, 5 perguntas)", () => {
    for (const nome of arquivos) {
      const cenario = importar(nome);
      expect(cenario.decisions, nome).toHaveLength(5);
      expect(cenario.questions.map((q) => q.decision)).toEqual(cenario.decisions.map((d) => d.id));
      for (const decisao of cenario.decisions) expect(decisao.procedure, nome).toMatch(/EXEMPLO/);
    }
  });

  it("todas as decisões cumpridas = tudo ok; nenhuma cumprida = tudo bad", () => {
    for (const nome of arquivos) {
      const cenario = importar(nome);
      const escolher = (cumprir: boolean) =>
        Object.fromEntries(
          cenario.questions.map((q) => [q.id, q.alternatives.findIndex((a) => a.taken === cumprir)])
        );
      const tudo = evaluate(cenario, takenFromPicks(cenario, escolher(true)));
      const nada = evaluate(cenario, takenFromPicks(cenario, escolher(false)));
      expect(
        tudo.outcomes.map((o) => o.nivel),
        `${nome}: tudo cumprido`
      ).toEqual(tudo.outcomes.map(() => "ok"));
      expect(
        nada.outcomes.map((o) => o.nivel),
        `${nome}: nada cumprido`
      ).toEqual(nada.outcomes.map(() => "bad"));
    }
  });

  it("usam só os planos e os comandos do pacote escritorio-gestao", () => {
    const planos: readonly string[] = ESCRITORIO_GESTAO.planos;
    const comandos: readonly string[] = ESCRITORIO_GESTAO.comandos;
    for (const nome of arquivos) {
      for (const pergunta of importar(nome).questions) {
        expect(planos, `${nome} ${pergunta.id}`).toContain(pergunta.shot);
        for (const alternativa of pergunta.alternatives)
          for (const [objeto, comando] of Object.entries(alternativa.beat.scene)) {
            expect(planos, `${nome} ${objeto}`).toContain(objeto);
            expect(comandos, `${nome} ${objeto}`).toContain(comando);
          }
      }
    }
  });

  it("o participante nunca recebe o gabarito: nem taken, nem beat, nem regras, nem procedimentos", () => {
    for (const nome of arquivos) {
      const cenario = importar(nome);
      const texto = JSON.stringify(visaoDoParticipante(cenario));
      for (const proibido of [
        '"taken"',
        '"beat"',
        '"tone"',
        '"procedure"',
        '"outcomes"',
        '"events"',
        '"decision"',
        '"levels"'
      ])
        expect(texto, `${nome} vazou ${proibido}`).not.toContain(proibido);
      // O que vai são só os textos das alternativas, na ordem original.
      for (const pergunta of visaoDoParticipante(cenario).questions)
        expect(pergunta.alternatives.map((a) => Object.keys(a).sort())).toEqual(
          pergunta.alternatives.map(() => ["indice", "text"])
        );
    }
  });
});

describe("o adaptador", () => {
  const exemplo = () => lerBruto(arquivos[0]!);

  it("troca id por slug, deriva o resumo, repete o título na introdução e descarta locale e status", () => {
    const bruto = exemplo();
    const adaptado = adaptarCenarioDoPacote(bruto) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(adaptado.slug).toBe(bruto.id);
    expect(adaptado).not.toHaveProperty("id");
    expect(adaptado).not.toHaveProperty("locale");
    expect(adaptado).not.toHaveProperty("status");
    expect(adaptado.intro.title).toBe(bruto.title);
    expect(adaptado.intro.captions).toEqual(bruto.intro.captions);
    expect(adaptado.summary).toBe(bruto.intro.captions[0]);
    expect(adaptado.publico).toBe(bruto.publico);
  });

  it("não altera o original", () => {
    const bruto = exemplo();
    const antes = JSON.stringify(bruto);
    adaptarCenarioDoPacote(bruto);
    expect(JSON.stringify(bruto)).toBe(antes);
  });

  it("cenário que já está no formato do projeto passa intacto", () => {
    const projeto = { slug: "ja-no-formato", title: "x" };
    expect(adaptarCenarioDoPacote(projeto)).toBe(projeto);
    expect(adaptarCenarioDoPacote(null)).toBeNull();
    expect(adaptarCenarioDoPacote("texto")).toBe("texto");
  });

  it("resumo longo é cortado numa frase e cabe no limite", () => {
    const bruto = exemplo();
    bruto.intro.captions[0] = `${"Uma frase de contexto. ".repeat(40)}`;
    const adaptado = adaptarCenarioDoPacote(bruto) as { summary: string };
    expect(adaptado.summary.length).toBeLessThanOrEqual(240);
    expect(adaptado.summary.endsWith(".")).toBe(true);
  });

  it("um erro de autoria aparece com o caminho exato, também depois de adaptar", () => {
    const bruto = exemplo();
    bruto.questions[2].alternatives[1].beat.title = "";
    const r = validarCenarioImportado(bruto);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.problemas.map((p) => p.caminho)).toContain("questions.2.alternatives.1.beat.title");
  });

  it("público desconhecido é recusado no campo certo", () => {
    const bruto = exemplo();
    bruto.publico = "diretoria-geral";
    const r = validarCenarioImportado(bruto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.caminho)).toContain("publico");
  });

  it("rótulo de tempo é texto curto livre (horário ou marca)", () => {
    const bruto = exemplo();
    bruto.questions[0].time = "Segunda, 08h";
    expect(validarCenarioImportado(bruto).ok).toBe(true);
    bruto.questions[0].time = "x".repeat(40);
    expect(validarCenarioImportado(bruto).ok).toBe(false);
  });
});
