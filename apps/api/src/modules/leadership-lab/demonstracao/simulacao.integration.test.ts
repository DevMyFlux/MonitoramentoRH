// A simulação local de ponta a ponta no servidor: o motor de verdade (PostgreSQL real), a IA de
// demonstração ramificada e o leitor do percurso. Exige LAB_TEST_DATABASE_URL.
import type { LabEscolha } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import {
  type Banco,
  TEMPO_LIMITE_S,
  configDeTeste,
  encerrarBanco,
  novoCenario,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import { MotorDoTeste } from "../motor/motor.js";
import type { RespostaDoTeste } from "../motor/visoes.js";
import { idsDasCategorias } from "../simulador/catalogo.js";
import { PREFIXO_DA_SIMULACAO } from "../simulador/provedor.js";
import { IaDemonstracao } from "./ia-demonstracao.js";
import { leitorDoPercurso } from "./leitor.js";

const TEMA = "climatizacao-ventilacao";

describe.skipIf(!integrationEnabled)("simulação local", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const montar = async (opcoes: { comTemas: boolean } = { comTemas: true }) => {
    const c = await novoCenario(banco);
    const motor = new MotorDoTeste({
      db: banco.prisma,
      ia: new IaDemonstracao(leitorDoPercurso(banco.prisma)),
      config: { ...configDeTeste(), demonstracao: opcoes.comTemas },
      agora: c.relogio.agora,
      ...(opcoes.comTemas ? { temasDeSimulacao: idsDasCategorias } : {})
    });
    return { c, motor };
  };

  async function jogar(escolhas: Array<LabEscolha | null>, tema: string | null = TEMA) {
    const { c, motor } = await montar();
    let atual: RespostaDoTeste = await motor.iniciar(c.ator, tema ? { categoriaId: tema } : {});
    const respostas = [atual];
    for (const escolha of escolhas) {
      if (atual.tipo !== "situacao") throw new Error("o teste acabou antes das escolhas");
      c.relogio.avancar(escolha === null ? (TEMPO_LIMITE_S + 1) * 1000 : 10_000);
      atual =
        escolha === null
          ? await motor.tempoEsgotado(c.ator, atual.sessaoId, { numero: atual.situacao.numero })
          : await motor.responder(c.ator, atual.sessaoId, {
              numero: atual.situacao.numero,
              escolha
            });
      respostas.push(atual);
    }
    return { c, motor, respostas, final: atual };
  }

  it("percorre o cenário pelo motor: 5 situações da simulação local e um resultado", async () => {
    const { respostas, final } = await jogar(["A", "B", "A", "A", "B"]);
    const situacoes = respostas.flatMap((r) => (r.tipo === "situacao" ? [r.situacao] : []));
    expect(situacoes).toHaveLength(5);
    for (const s of situacoes) expect(s.texto.startsWith(PREFIXO_DA_SIMULACAO)).toBe(true);
    expect(situacoes.map((s) => s.marco)).toEqual([false, false, true, false, false]);
    expect(situacoes[2]?.texto).toContain("Até aqui, você alinhou com a responsável assistencial");
    expect(final.tipo).toBe("resultado");
  });

  it("a escolha muda a consequência e a situação seguinte, e a trilha boa pontua mais", async () => {
    const boa = await jogar(["A", "B", "A", "A", "B"]);
    const ruim = await jogar(["B", "A", "A", "C", "A"]);
    const textoDa = (r: RespostaDoTeste | undefined) =>
      r?.tipo === "situacao" ? r.situacao : null;
    expect(textoDa(boa.respostas[1])?.consequencia).not.toBe(
      textoDa(ruim.respostas[1])?.consequencia
    );
    expect(textoDa(boa.respostas[1])?.texto).not.toBe(textoDa(ruim.respostas[1])?.texto);
    if (boa.final.tipo !== "resultado" || ruim.final.tipo !== "resultado")
      throw new Error("resultado");
    expect(boa.final.resultado.aderenciaGeral).toBeGreaterThan(ruim.final.resultado.aderenciaGeral);
  });

  it("o resultado e o mapa batem com o caminho: as situações mostradas são as visitadas, com a escolha de cada uma", async () => {
    const { final } = await jogar(["B", "A", "A", "C", "C"]);
    if (final.tipo !== "resultado") throw new Error("resultado");
    expect(final.resultado.situacoes.map((s) => s.escolha)).toEqual(["B", "A", "A", "C", "C"]);
    // n1 -> n2b -> n3b -> n4b (a opção C é a da linha vermelha, aderência 10)
    expect(final.resultado.situacoes.map((s) => s.aderencia)).toEqual([40, 40, 40, 10, 100]);
    expect(final.resultado.resumo).toContain("Simulação local");
    expect(final.resultado.resumo).toContain("1) mandou o técnico sem alinhar com a assistência");
  });

  it("omissão por tempo esgotado segue o caminho de omissão e conta 0", async () => {
    const { final } = await jogar([null, "C", "A", "A", "B"]);
    if (final.tipo !== "resultado") throw new Error("resultado");
    expect(final.resultado.situacoes[0]).toMatchObject({
      tempoEsgotado: true,
      escolha: null,
      aderencia: 0
    });
  });

  it("a linha vermelha abre alerta para o curador", async () => {
    const { c } = await jogar(["B", "A", "A", "C", "C"]);
    const r = await banco.db.client.query(
      `SELECT a.cor, t.numero FROM leadership_lab.alerta a
         JOIN leadership_lab.turno t ON t.id = a.turno_id
         JOIN leadership_lab.sessao s ON s.id = a.sessao_id
        WHERE s.participante_id = $1`,
      [c.ctx.participanteId]
    );
    expect(r.rows).toEqual([{ cor: "vermelho", numero: 4 }]);
  });

  it("o que vai ao navegador durante o teste nunca traz avaliação", async () => {
    const { respostas } = await jogar(["A", "B", "A", "A"]);
    const proibidas =
      /aderencia|estilo|skill|alerta|justificativa|linhaVermelha|proximo|resumo|aoOmitir/i;
    for (const r of respostas) {
      if (r.tipo !== "situacao") continue;
      expect(Object.keys(r.situacao).sort()).toEqual(
        [
          "consequencia",
          "marco",
          "numero",
          "opcoes",
          "tempoLimiteS",
          "tempoRestanteMs",
          "texto"
        ].sort()
      );
      expect(JSON.stringify(r)).not.toMatch(proibidas);
    }
  });

  it("recarregar no meio do teste retoma a mesma situação (o caminho vem do banco)", async () => {
    const { c, motor } = await montar();
    const aberta = await motor.iniciar(c.ator, { categoriaId: TEMA });
    if (aberta.tipo !== "situacao") throw new Error("situação 1");
    c.relogio.avancar(5_000);
    const segunda = await motor.responder(c.ator, aberta.sessaoId, { numero: 1, escolha: "A" });
    // Outra instância do motor (outro processo): relê o estado e o caminho do banco.
    const outro = new MotorDoTeste({
      db: banco.prisma,
      ia: new IaDemonstracao(leitorDoPercurso(banco.prisma)),
      config: { ...configDeTeste(), demonstracao: true },
      agora: c.relogio.agora,
      temasDeSimulacao: idsDasCategorias
    });
    const lida = await outro.estadoDoTeste(c.ator);
    expect(lida).toMatchObject({ tipo: "situacao" });
    c.relogio.avancar(5_000);
    const terceira = await outro.responder(c.ator, aberta.sessaoId, { numero: 2, escolha: "B" });
    expect(segunda.tipo).toBe("situacao");
    expect(terceira.tipo === "situacao" && terceira.situacao.texto).toContain(
      "Até aqui, você alinhou"
    );
  });

  it("repetir a mesma resposta é idempotente e não muda o caminho", async () => {
    const { c, motor } = await montar();
    const aberta = await motor.iniciar(c.ator, { categoriaId: TEMA });
    if (aberta.tipo !== "situacao") throw new Error("situação 1");
    c.relogio.avancar(5_000);
    const a = await motor.responder(c.ator, aberta.sessaoId, { numero: 1, escolha: "A" });
    const b = await motor.responder(c.ator, aberta.sessaoId, { numero: 1, escolha: "A" });
    expect(b).toEqual(a);
  });

  it("tema desconhecido é recusado, e sem simulação ativa categoriaId também", async () => {
    const { c, motor } = await montar();
    await expect(motor.iniciar(c.ator, { categoriaId: "nao-existe" })).rejects.toMatchObject({
      code: "LAB_TEMA_INVALIDO"
    });
    const sem = await montar({ comTemas: false });
    await expect(sem.motor.iniciar(sem.c.ator, { categoriaId: TEMA })).rejects.toMatchObject({
      code: "LAB_TEMA_INVALIDO"
    });
    expect(sem.motor.temSimulador).toBe(false);
    expect(motor.temSimulador).toBe(true);
  });

  it("sem tema, a demonstração geral continua igual", async () => {
    const { respostas } = await jogar(["A", "C", "B", "A", "C"], null);
    const primeira = respostas[0];
    expect(primeira?.tipo === "situacao" && primeira.situacao.texto).toMatch(/^\(Demonstração\) /);
  });

  it("o texto digitado para descrever o problema não chega ao banco nem à resposta do teste", async () => {
    // O motor nem recebe a descrição: só o id do tema. Conferimos que a sessão guarda o id do tema,
    // nunca texto livre do participante.
    const { c } = await jogar(["A", "B", "A", "A", "B"]);
    const r = await banco.db.client.query(
      `SELECT ia_sessao_id FROM leadership_lab.sessao WHERE participante_id = $1`,
      [c.ctx.participanteId]
    );
    expect(String(r.rows[0]?.ia_sessao_id)).toMatch(/^sim\.5\.[a-z]+\.climatizacao-ventilacao\./);
  });
});
