import type { LabItemDaRevisao } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import {
  chaveDoIntervalo,
  filtrarResultados,
  filtrosPadrao,
  granularidadeDoPeriodo,
  haFiltroAtivo,
  itensDeAtencao,
  opcoesDeParticipante,
  resultadosDoPeriodoAnterior,
  tendenciaDosResultados,
  variacaoEmPontos
} from "./visao-geral-filtros";

const AGORA = new Date("2026-03-20T15:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000).toISOString();

function item(id: string, extra: Partial<LabItemDaRevisao> & { dias?: number } = {}) {
  const { dias = 1, ...resto } = extra;
  return {
    resultadoId: `r-${id}`,
    sessaoId: `s-${id}`,
    concluidaEm: diasAtras(dias),
    statusValidacao: "aguardando_validacao",
    experimental: false,
    participante: {
      id: `p-${id}`,
      nome: `Pessoa ${id}`,
      identificador: id,
      cargo: null,
      operacao: "Op"
    },
    moldeNome: "Supervisor",
    aderenciaGeral: 70,
    agilidade: 60,
    alertasAbertos: 0,
    contestacoesPendentes: 0,
    ...resto
  } satisfies LabItemDaRevisao;
}

const sem = { participantesDaTurma: null, agora: AGORA };

describe("filtrarResultados", () => {
  const itens = [
    item("a", { dias: 2 }),
    item("b", { dias: 20, moldeNome: "Coordenador", statusValidacao: "validado" }),
    item("c", { dias: 60 })
  ];

  it("sem filtro, devolve tudo; com período, corta pelo tempo", () => {
    expect(filtrarResultados(itens, filtrosPadrao, sem)).toHaveLength(3);
    expect(
      filtrarResultados(itens, { ...filtrosPadrao, periodo: "7d" }, sem).map((i) => i.resultadoId)
    ).toEqual(["r-a"]);
    expect(filtrarResultados(itens, { ...filtrosPadrao, periodo: "30d" }, sem)).toHaveLength(2);
  });

  it("filtra por teste, status e participante, e combina os filtros", () => {
    expect(filtrarResultados(itens, { ...filtrosPadrao, teste: "Coordenador" }, sem)).toHaveLength(
      1
    );
    expect(
      filtrarResultados(itens, { ...filtrosPadrao, status: "validado" }, sem)[0]?.resultadoId
    ).toBe("r-b");
    expect(filtrarResultados(itens, { ...filtrosPadrao, participanteId: "p-c" }, sem)).toHaveLength(
      1
    );
    expect(
      filtrarResultados(itens, { ...filtrosPadrao, status: "validado", teste: "Supervisor" }, sem)
    ).toHaveLength(0);
  });

  it("a turma restringe aos participantes dela; sem a lista carregada, nada passa", () => {
    const f = { ...filtrosPadrao, turmaId: "t1" };
    expect(
      filtrarResultados(itens, f, { agora: AGORA, participantesDaTurma: new Set(["p-a", "p-c"]) })
    ).toHaveLength(2);
    expect(filtrarResultados(itens, f, sem)).toHaveLength(0);
  });
});

describe("comparação com o período anterior", () => {
  it("usa a janela de mesmo tamanho logo antes, com os mesmos filtros", () => {
    const itens = [item("a", { dias: 3 }), item("b", { dias: 10 }), item("c", { dias: 16 })];
    const f = { ...filtrosPadrao, periodo: "7d" as const };
    expect(resultadosDoPeriodoAnterior(itens, f, sem)?.map((i) => i.resultadoId)).toEqual(["r-b"]);
    expect(resultadosDoPeriodoAnterior(itens, filtrosPadrao, sem)).toBeNull();
  });

  it("a variação é em pontos e some se faltar um dos lados", () => {
    expect(variacaoEmPontos(72.5, 70)).toBe(2.5);
    expect(variacaoEmPontos(60, 70)).toBe(-10);
    expect(variacaoEmPontos(null, 70)).toBeNull();
    expect(variacaoEmPontos(70, null)).toBeNull();
  });
});

describe("tendência", () => {
  it("a granularidade segue o período", () => {
    expect(granularidadeDoPeriodo("7d")).toBe("dia");
    expect(granularidadeDoPeriodo("30d")).toBe("semana");
    expect(granularidadeDoPeriodo("tudo")).toBe("mes");
  });

  it("a semana começa na segunda-feira (domingo pertence à semana anterior)", () => {
    // 2026-03-15 é domingo; 2026-03-16 é segunda.
    expect(chaveDoIntervalo("2026-03-15T15:00:00Z", "semana")).toBe("2026-03-09");
    expect(chaveDoIntervalo("2026-03-16T15:00:00Z", "semana")).toBe("2026-03-16");
    expect(chaveDoIntervalo("2026-03-16T15:00:00Z", "mes")).toBe("2026-03");
  });

  it("agrupa e tira a média por intervalo, em ordem cronológica", () => {
    const itens = [
      item("a", { concluidaEm: "2026-03-16T15:00:00Z", aderenciaGeral: 80, agilidade: 50 }),
      item("b", { concluidaEm: "2026-03-17T15:00:00Z", aderenciaGeral: 60, agilidade: 70 }),
      item("c", { concluidaEm: "2026-03-10T15:00:00Z", aderenciaGeral: 90, agilidade: 90 })
    ];
    const pontos = tendenciaDosResultados(itens, "semana");
    expect(pontos.map((p) => p.chave)).toEqual(["2026-03-09", "2026-03-16"]);
    expect(pontos[1]).toMatchObject({ resultados: 2, aderencia: 70, agilidade: 60 });
  });
});

describe("o que pede atenção", () => {
  it("junta alerta, contestação e validação parada, e põe primeiro quem tem mais motivos", () => {
    const itens = [
      item("a", { alertasAbertos: 1 }),
      item("b", { dias: 5 }), // validação parada há mais de 3 dias
      item("c", { dias: 1 }), // recente e sem pendência: não entra
      item("d", { alertasAbertos: 2, contestacoesPendentes: 1 }),
      item("e", { dias: 9, statusValidacao: "validado" }) // validado: não está parado
    ];
    const lista = itensDeAtencao(itens, AGORA);
    expect(lista.map((x) => x.item.resultadoId)).toEqual(["r-d", "r-b", "r-a"]);
    expect(lista[0]?.motivos).toEqual(["alerta", "contestacao"]);
    expect(lista[1]?.motivos).toEqual(["validacao-atrasada"]);
  });
});

describe("apoio", () => {
  it("haFiltroAtivo só é verdadeiro fora do padrão", () => {
    expect(haFiltroAtivo(filtrosPadrao)).toBe(false);
    expect(haFiltroAtivo({ ...filtrosPadrao, status: "validado" })).toBe(true);
  });

  it("lista cada participante uma vez, em ordem alfabética", () => {
    const itens = [item("b"), item("a"), item("b", { dias: 4 })];
    expect(opcoesDeParticipante(itens).map((o) => o.nome)).toEqual(["Pessoa a", "Pessoa b"]);
  });
});
