// A IA de demonstração no modo simulação local: percorre os cenários da biblioteca respeitando o
// contrato da IA, sem nenhum serviço externo.
import { type LabEscolha, labEscolhas, labMoldeNiveis } from "@my-flux/shared";
import { describe, expect, it, vi } from "vitest";
import { LIMITE_PALAVRAS_SITUACAO, validarAberturaIa, validarTurnoIa } from "../ia/ia-contrato.js";
import { categoriasDaBiblioteca, cenarioDe } from "../simulador/catalogo.js";
import type { PassoDoPercurso } from "../simulador/percurso.js";
import { PREFIXO_DA_SIMULACAO } from "../simulador/provedor.js";
import { IaDemonstracao } from "./ia-demonstracao.js";

type Saida = Record<string, unknown>;

/** Joga um teste inteiro com as escolhas dadas; devolve todos os turnos. */
async function jogar(args: {
  tema: string;
  molde: "encarregado" | "supervisor" | "coordenador";
  escolhas: ReadonlyArray<LabEscolha | null>;
}) {
  const gravados: PassoDoPercurso[] = [];
  const leitor = vi.fn(async () => [...gravados]);
  const ia = new IaDemonstracao(leitor);

  const abertura = await ia.abrirSessao({
    molde: args.molde,
    temas: [args.tema],
    numero_situacoes: 5
  });
  const aberturaValida = validarAberturaIa(abertura);
  if (!aberturaValida.ok) throw new Error(aberturaValida.problemas.join("; "));
  const sessaoId = aberturaValida.valor.sessao_id;

  const turnos: Saida[] = [abertura as Saida];
  for (let numero = 1; numero <= 5; numero += 1) {
    const escolha = args.escolhas[numero - 1] ?? null;
    // O motor grava a escolha ANTES de chamar a IA.
    gravados.push({ numero, escolha });
    const bruto = await ia.proximoTurno({
      sessao_id: sessaoId,
      numero,
      escolha,
      tempo_esgotado: escolha === null,
      texto_livre: null
    });
    const valido = validarTurnoIa(bruto, { numero, escolha, totalSituacoes: 5 });
    if (!valido.ok) throw new Error(`turno ${numero}: ${valido.problemas.join("; ")}`);
    expect(valido.avisos, `turno ${numero}`).toEqual([]);
    turnos.push(bruto as Saida);
  }
  return { turnos, sessaoId, leitor };
}

const textoDe = (turno: Saida): string => (turno.situacao as { texto: string }).texto;

describe("simulação local na IA de demonstração", () => {
  it("abre pelo tema, identifica a simulação local e usa o cenário do cargo", async () => {
    const ia = new IaDemonstracao(async () => []);
    for (const molde of labMoldeNiveis) {
      const r = (await ia.abrirSessao({
        molde,
        temas: ["climatizacao-ventilacao"],
        numero_situacoes: 5
      })) as Saida;
      const cenario = cenarioDe("climatizacao-ventilacao", molde);
      expect(textoDe(r)).toBe(`${PREFIXO_DA_SIMULACAO}${cenario?.aberturas[molde]}`);
      expect(String(r.sessao_id)).toMatch(
        new RegExp(`^sim\\.5\\.${molde}\\.climatizacao-ventilacao\\.`)
      );
      expect((r.uso as { modelo: string }).modelo).toBe("simulador-local");
    }
  });

  it("a abertura muda por cargo e o resto do cenário é comum", async () => {
    const ia = new IaDemonstracao(async () => []);
    const textos = await Promise.all(
      labMoldeNiveis.map(async (molde) =>
        textoDe(
          (await ia.abrirSessao({
            molde,
            temas: ["climatizacao-ventilacao"],
            numero_situacoes: 5
          })) as Saida
        )
      )
    );
    expect(new Set(textos).size).toBe(3);
  });

  it("sem tema da biblioteca, cai na demonstração geral (não é simulação)", async () => {
    const ia = new IaDemonstracao(async () => []);
    const r = (await ia.abrirSessao({
      molde: "supervisor",
      temas: ["Prioridade de OS"],
      numero_situacoes: 5
    })) as Saida;
    expect(String(r.sessao_id)).toMatch(/^demo\.5\./);
    expect(textoDe(r)).toMatch(/^\(Demonstração\) /);
  });

  it("recusa simulação com número de situações diferente de 5", async () => {
    const ia = new IaDemonstracao(async () => []);
    await expect(
      ia.abrirSessao({
        molde: "supervisor",
        temas: ["climatizacao-ventilacao"],
        numero_situacoes: 4
      })
    ).rejects.toThrow(/exatamente 5/);
  });

  it("todos os 1024 caminhos (A, B, C ou tempo esgotado) obedecem ao contrato e ao limite de palavras", async () => {
    const opcoes = [...labEscolhas, null] as const;
    for (const categoria of categoriasDaBiblioteca) {
      const caminhos: Array<Array<LabEscolha | null>> = [[]];
      for (let i = 0; i < 5; i += 1) {
        const prox: Array<Array<LabEscolha | null>> = [];
        for (const c of caminhos) for (const o of opcoes) prox.push([...c, o]);
        caminhos.splice(0, caminhos.length, ...prox);
      }
      expect(caminhos).toHaveLength(1024);
      for (const escolhas of caminhos) {
        const { turnos } = await jogar({ tema: categoria.id, molde: "supervisor", escolhas });
        const situacoes = turnos.slice(0, 5).map(textoDe);
        for (const t of situacoes) {
          expect(t.split(/\s+/).length, t).toBeLessThanOrEqual(LIMITE_PALAVRAS_SITUACAO);
          expect(t.startsWith(PREFIXO_DA_SIMULACAO)).toBe(true);
        }
        expect(turnos[5]?.tipo).toBe("resultado");
      }
    }
  });

  it("o marco (situação 3) recorda as duas primeiras escolhas do próprio caminho", async () => {
    const a = await jogar({
      tema: "climatizacao-ventilacao",
      molde: "supervisor",
      escolhas: ["A", "B", "A", "C", "B"]
    });
    const b = await jogar({
      tema: "climatizacao-ventilacao",
      molde: "supervisor",
      escolhas: ["C", "A", "A", "C", "B"]
    });
    // turnos[0] abre a situação 1; turnos[2] traz a situação 3
    expect(textoDe(a.turnos[2] as Saida)).toContain(
      "Até aqui, você alinhou com a responsável assistencial antes de agir e montou"
    );
    expect(textoDe(b.turnos[2] as Saida)).toContain(
      "Até aqui, você adiou o chamado sem registrar e"
    );
    expect(textoDe(a.turnos[2] as Saida)).not.toBe(textoDe(b.turnos[2] as Saida));
    // e as demais situações não ganham recordação
    expect(textoDe(a.turnos[3] as Saida)).not.toContain("Até aqui");
  });

  it("a escolha muda a consequência e a próxima situação", async () => {
    const boa = await jogar({
      tema: "climatizacao-ventilacao",
      molde: "supervisor",
      escolhas: ["A", "B", "A", "A", "B"]
    });
    const ruim = await jogar({
      tema: "climatizacao-ventilacao",
      molde: "supervisor",
      escolhas: ["B", "B", "A", "A", "B"]
    });
    expect(boa.turnos[1]?.consequencia).not.toBe(ruim.turnos[1]?.consequencia);
    expect(textoDe(boa.turnos[1] as Saida)).not.toBe(textoDe(ruim.turnos[1] as Saida));
  });

  it("tempo esgotado: aderência 0, consequência própria e caminho de omissão", async () => {
    const { turnos } = await jogar({
      tema: "climatizacao-ventilacao",
      molde: "supervisor",
      escolhas: [null, "C", "A", "A", "B"]
    });
    const avaliacao = turnos[1]?.avaliacao_anterior as {
      aderencia: number;
      escolha: null;
      skills: string[];
    };
    expect(avaliacao.aderencia).toBe(0);
    expect(avaliacao.escolha).toBeNull();
    expect(avaliacao.skills.length).toBeGreaterThan(0);
    expect(String(turnos[1]?.consequencia)).toMatch(/ficou parado|ninguém decidiu/);
    expect(textoDe(turnos[2] as Saida)).toContain("não decidiu a tempo");
  });

  it("a linha vermelha gera o alerta vermelho (aderência 10)", async () => {
    const { turnos } = await jogar({
      tema: "climatizacao-ventilacao",
      molde: "supervisor",
      escolhas: ["B", "A", "A", "C", "C"]
    });
    // situação 4 (nó n4b), opção C: autoriza o improviso
    const avaliacao = turnos[4]?.avaliacao_anterior as { aderencia: number; alerta: string | null };
    expect(avaliacao).toMatchObject({ aderencia: 10, alerta: "vermelho" });
  });

  it("o resultado traz o caminho percorrido e nenhum número", async () => {
    const { turnos } = await jogar({
      tema: "climatizacao-ventilacao",
      molde: "coordenador",
      escolhas: ["A", "B", "A", "C", "B"]
    });
    const resultado = turnos[5]?.resultado as Saida;
    expect(String(resultado.resumo)).toContain(
      "1) alinhou com a responsável assistencial antes de agir"
    );
    expect(String(resultado.resumo)).toContain("5) ");
    expect(JSON.stringify(resultado)).not.toMatch(/aderencia|agilidade/i);
    expect(String(resultado.sugestoes)).toMatch(/demonstrativo/);
  });

  it("recomeça de qualquer instância: o caminho vem do leitor, não da memória", async () => {
    const gravados: PassoDoPercurso[] = [{ numero: 1, escolha: "A" }];
    const primeira = new IaDemonstracao(async () => gravados);
    const abertura = (await primeira.abrirSessao({
      molde: "supervisor",
      temas: ["climatizacao-ventilacao"],
      numero_situacoes: 5
    })) as Saida;
    const sessaoId = String(abertura.sessao_id);
    const outra = new IaDemonstracao(async () => gravados);
    const r = (await outra.proximoTurno({
      sessao_id: sessaoId,
      numero: 1,
      escolha: "A",
      tempo_esgotado: false,
      texto_livre: null
    })) as Saida;
    expect(textoDe(r)).toMatch(/Com a criticidade alinhada/);
  });

  it("falha se o histórico estiver incompleto ou o identificador for inválido", async () => {
    const ia = new IaDemonstracao(async () => []);
    const abertura = (await ia.abrirSessao({
      molde: "supervisor",
      temas: ["climatizacao-ventilacao"],
      numero_situacoes: 5
    })) as Saida;
    await expect(
      ia.proximoTurno({
        sessao_id: String(abertura.sessao_id),
        numero: 3,
        escolha: "A",
        tempo_esgotado: false,
        texto_livre: null
      })
    ).rejects.toThrow(/falta a escolha/);
    await expect(
      ia.proximoTurno({
        sessao_id: "sim.5.supervisor.nao-existe.abc",
        numero: 1,
        escolha: "A",
        tempo_esgotado: false,
        texto_livre: null
      })
    ).rejects.toThrow(/sem cenário/);
    await expect(
      ia.proximoTurno({
        sessao_id: "sim.7.supervisor.climatizacao-ventilacao.abc",
        numero: 1,
        escolha: "A",
        tempo_esgotado: false,
        texto_livre: null
      })
    ).rejects.toThrow(/inválida/);
  });

  it("não faz nenhuma chamada de rede", async () => {
    const fetchEspiao = vi.spyOn(globalThis, "fetch");
    await jogar({
      tema: "climatizacao-ventilacao",
      molde: "encarregado",
      escolhas: ["A", "B", "A", "A", "B"]
    });
    expect(fetchEspiao).not.toHaveBeenCalled();
    fetchEspiao.mockRestore();
  });
});
