import { labSkillsPiloto, type LabEstilo } from "@my-flux/shared";
import type { LabMolde } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { EstadoDoInicio, SessaoComMolde } from "../motor/precondicoes.js";
import {
  type DadosDoPainel,
  type LinhaDeAlerta,
  type LinhaDeEscolha,
  type LinhaDeSkill,
  acaoDoPainel,
  montarPainel
} from "./montagem.js";
import { LIMITES_DO_PAINEL } from "./tipos.js";

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

const t = (iso: string) => new Date(iso);

function molde(extra: Partial<LabMolde> = {}): LabMolde {
  return {
    id: "molde-1",
    nivel: "supervisor",
    nome: "Supervisor",
    temas: ["Prioridade de OS"],
    numeroSituacoes: 5,
    tempoLimiteS: 60,
    ativo: true,
    atualizadoPor: null,
    criadoEm: t("2026-01-01T00:00:00Z"),
    atualizadoEm: t("2026-01-01T00:00:00Z"),
    ...extra
  };
}

function sessao(): SessaoComMolde {
  return {
    id: "sessao-andamento",
    participanteId: "p1",
    moldeId: "molde-1",
    modo: "dinamico",
    iaSessaoId: "ia-1",
    status: "em_andamento",
    iniciadaEm: t("2026-03-02T10:00:00Z"),
    concluidaEm: null,
    molde: molde()
  };
}

function dados(extra: Partial<DadosDoPainel> = {}): DadosDoPainel {
  return {
    demonstracao: false,
    termo: { versaoAtual: "2026-1", aceitoEm: t("2026-03-01T09:00:00Z") },
    inicio: {
      estado: { tipo: "iniciar", molde: molde(), temas: ["Prioridade de OS"] },
      situacaoAtual: null
    },
    indicadores: {
      testesFeitos: 0,
      testesValidados: 0,
      aderenciaMedia: null,
      agilidadeMedia: null,
      ultimoTesteEm: null
    },
    resultados: [],
    skills: [],
    escolhasDeEstilo: [],
    alertas: [],
    ultimoResultado: null,
    ...extra
  };
}

const comTestes = (n: number, extra: Partial<DadosDoPainel> = {}) =>
  dados({
    indicadores: {
      testesFeitos: n,
      testesValidados: 0,
      aderenciaMedia: 70,
      agilidadeMedia: 80,
      ultimoTesteEm: t("2026-03-05T10:00:00Z")
    },
    ...extra
  });

const escolha = (
  sessaoId: string,
  estilo: LabEstilo,
  estiloAdequado: LabEstilo = estilo,
  statusValidacao = "aguardando_validacao"
): LinhaDeEscolha => ({ sessaoId, statusValidacao, estilo, estiloAdequado });

function skill(extra: Partial<LinhaDeSkill> & { skillId: string }): LinhaDeSkill {
  return {
    nivel: 3,
    nEvidencias: 2,
    validado: false,
    nivelValidado: null,
    sessaoId: "s-1",
    resultadoId: "r-1",
    concluidaEm: t("2026-03-02T10:10:00Z"),
    ...extra
  };
}

function alerta(extra: Partial<LinhaDeAlerta> & { id: string }): LinhaDeAlerta {
  return {
    cor: "vermelho",
    criadoEm: t("2026-03-02T10:00:00Z"),
    skillId: null,
    skillNome: null,
    situacao: 3,
    sessaoId: "s-1",
    resultadoId: "r-1",
    concluidaEm: t("2026-03-02T10:10:00Z"),
    ...extra
  };
}

// ---------------------------------------------------------------------------

describe("montarPainel: participante sem nenhum teste", () => {
  const painel = montarPainel(dados());

  it("zera os indicadores e deixa a evolução vazia", () => {
    expect(painel.indicadores).toEqual({
      testesFeitos: 0,
      testesValidados: 0,
      aderenciaMedia: null,
      agilidadeMedia: null,
      ultimoTesteEm: null
    });
    expect(painel.evolucao).toEqual({ pontos: [], tendenciaDisponivel: false });
  });

  it("mostra as 8 skills do piloto, em ordem, sem nível e sem evidência", () => {
    expect(painel.skills.map((s) => s.skillId)).toEqual(labSkillsPiloto.map((s) => s.id));
    expect(painel.skills.map((s) => s.tipo)).toEqual([
      "hard",
      "hard",
      "hard",
      "hard",
      "soft",
      "soft",
      "soft",
      "soft"
    ]);
    for (const s of painel.skills) {
      expect(s).toMatchObject({
        nivel: null,
        nivelCalculado: null,
        validado: false,
        nEvidencias: 0,
        resultadoId: null,
        sessaoId: null,
        atualizadoEm: null
      });
    }
  });

  it("não há perfil, alerta nem sugestão", () => {
    expect(painel.tipoDePerfil).toEqual({
      disponivel: false,
      testesFeitos: 0,
      testesNecessarios: 3
    });
    expect(painel.alertas).toEqual([]);
    expect(painel.sugestoes).toEqual({ itens: [], origem: null });
  });

  it("traz o termo e a ação de iniciar", () => {
    expect(painel.termo).toEqual({
      versaoAtual: "2026-1",
      aceito: true,
      aceitoEm: t("2026-03-01T09:00:00Z")
    });
    expect(painel.acao).toEqual({
      tipo: "iniciar",
      molde: { id: "molde-1", nivel: "supervisor", nome: "Supervisor" }
    });
  });

  it("termo ainda não aceito", () => {
    const p = montarPainel(dados({ termo: { versaoAtual: "2026-1", aceitoEm: null } }));
    expect(p.termo).toEqual({ versaoAtual: "2026-1", aceito: false, aceitoEm: null });
  });
});

describe("ação (o botão)", () => {
  const molde1 = molde();
  const casos: Array<[string, EstadoDoInicio, unknown]> = [
    [
      "tudo certo",
      { tipo: "iniciar", molde: molde1, temas: ["x"] },
      { tipo: "iniciar", molde: { id: "molde-1", nivel: "supervisor", nome: "Supervisor" } }
    ],
    [
      "termo pendente",
      { tipo: "termo-pendente" },
      { tipo: "indisponivel", motivo: "termo-pendente", molde: null, limiteDiario: null }
    ],
    [
      "cargo não informado",
      { tipo: "cargo-nao-informado" },
      { tipo: "indisponivel", motivo: "cargo-nao-informado", molde: null, limiteDiario: null }
    ],
    [
      "cargo sem molde",
      { tipo: "molde-nao-mapeado" },
      { tipo: "indisponivel", motivo: "molde-nao-mapeado", molde: null, limiteDiario: null }
    ],
    [
      "molde não liberado",
      { tipo: "molde-inativo", molde: molde1 },
      {
        tipo: "indisponivel",
        motivo: "molde-inativo",
        molde: { id: "molde-1", nivel: "supervisor", nome: "Supervisor" },
        limiteDiario: null
      }
    ],
    [
      "limite do dia",
      { tipo: "limite-diario", molde: molde1, limite: 2 },
      {
        tipo: "indisponivel",
        motivo: "limite-diario",
        molde: { id: "molde-1", nivel: "supervisor", nome: "Supervisor" },
        limiteDiario: 2
      }
    ]
  ];

  it.each(casos)("%s", (_nome, estado, esperado) => {
    expect(acaoDoPainel({ estado, situacaoAtual: null })).toEqual(esperado);
  });

  it("teste em andamento: continuar, com a situação em que parou e o total, sem dado de avaliação", () => {
    const acao = acaoDoPainel({
      estado: { tipo: "continuar", sessao: sessao() },
      situacaoAtual: 3
    });
    expect(acao).toEqual({
      tipo: "continuar",
      sessaoId: "sessao-andamento",
      situacaoAtual: 3,
      totalSituacoes: 5,
      molde: { id: "molde-1", nivel: "supervisor", nome: "Supervisor" }
    });
  });

  it("continuar sem nenhuma situação gravada é dado inconsistente: falha em vez de inventar", () => {
    expect(() =>
      acaoDoPainel({ estado: { tipo: "continuar", sessao: sessao() }, situacaoAtual: null })
    ).toThrow(/sem nenhuma situação/);
  });
});

describe("indicadores", () => {
  it("arredonda as médias a 2 casas e mantém nulos", () => {
    const p = montarPainel(
      dados({
        indicadores: {
          testesFeitos: 3,
          testesValidados: 1,
          aderenciaMedia: 73.33333333333333,
          agilidadeMedia: 88.8888,
          ultimoTesteEm: t("2026-03-05T10:00:00Z")
        }
      })
    );
    expect(p.indicadores).toMatchObject({
      testesFeitos: 3,
      testesValidados: 1,
      aderenciaMedia: 73.33,
      agilidadeMedia: 88.89
    });
  });
});

describe("tendência e tipo de perfil: só depois de 3 testes", () => {
  const escolhas = [escolha("a", "apoio"), escolha("b", "direcao"), escolha("c", "apoio")];

  it.each([0, 1, 2])("com %s testes não há tendência nem perfil", (n) => {
    const p = montarPainel(comTestes(n, { escolhasDeEstilo: escolhas }));
    expect(p.evolucao.tendenciaDisponivel).toBe(false);
    expect(p.tipoDePerfil).toEqual({ disponivel: false, testesFeitos: n, testesNecessarios: 3 });
  });

  it("mesmo que a leitura traga escolhas, abaixo do portão nada de estilo vai para a resposta", () => {
    const texto = JSON.stringify(
      montarPainel(comTestes(2, { escolhasDeEstilo: escolhas })).tipoDePerfil
    );
    for (const proibido of [
      "apoio",
      "direcao",
      "distribuicao",
      "estiloPredominante",
      "flexibilidade"
    ]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });

  it.each([3, 4, 10])("com %s testes há tendência e perfil", (n) => {
    const p = montarPainel(comTestes(n, { escolhasDeEstilo: escolhas }));
    expect(p.evolucao.tendenciaDisponivel).toBe(true);
    expect(p.tipoDePerfil.disponivel).toBe(true);
  });
});

describe("tipo de perfil: junta as escolhas de todos os testes", () => {
  const perfil = (escolhas: LinhaDeEscolha[]) => {
    const p = montarPainel(comTestes(3, { escolhasDeEstilo: escolhas })).tipoDePerfil;
    if (!p.disponivel) throw new Error("perfil deveria estar disponível");
    return p;
  };

  it("estilo predominante, distribuição (o quadrante) e flexibilidade", () => {
    const p = perfil([
      escolha("a", "apoio", "apoio"),
      escolha("a", "apoio", "orientacao"),
      escolha("b", "apoio", "apoio"),
      escolha("c", "direcao", "direcao")
    ]);
    expect(p).toMatchObject({
      estiloPredominante: "apoio",
      estilosEmpatados: [],
      distribuicao: { direcao: 1, orientacao: 0, apoio: 3, delegacao: 0 },
      nEscolhas: 4,
      flexibilidadePct: 75,
      flexibilidade: "media"
    });
  });

  it("vale a frequência das ESCOLHAS, não a maioria dos testes", () => {
    // O teste a, sozinho, tem predominante "apoio"; b e c, "direcao". Por teste, "direcao" venceria
    // (2 a 1). Pelas escolhas, "apoio" vence (3 a 2), que é o que a documentação define.
    const p = perfil([
      escolha("a", "apoio"),
      escolha("a", "apoio"),
      escolha("a", "apoio"),
      escolha("b", "direcao"),
      escolha("c", "direcao")
    ]);
    expect(p.estiloPredominante).toBe("apoio");
    expect(p.distribuicao).toMatchObject({ apoio: 3, direcao: 2 });
  });

  it("empate: não escolhe um e lista os empatados", () => {
    const p = perfil([
      escolha("a", "apoio"),
      escolha("b", "orientacao"),
      escolha("c", "apoio"),
      escolha("c", "orientacao")
    ]);
    expect(p.estiloPredominante).toBeNull();
    expect(p.estilosEmpatados).toEqual(["orientacao", "apoio"]);
  });

  it("conta quantos testes contribuíram e quantos ainda aguardam validação", () => {
    const p = perfil([
      escolha("a", "apoio", "apoio", "validado"),
      escolha("a", "apoio", "apoio", "validado"),
      escolha("b", "direcao", "direcao", "aguardando_validacao"),
      escolha("c", "apoio", "apoio", "ajustado")
    ]);
    expect(p).toMatchObject({ testesConsiderados: 3, testesAguardandoValidacao: 1, nEscolhas: 4 });
  });

  it("com 3 testes mas nenhuma escolha que envolva a equipe: disponível, porém vazio", () => {
    const p = perfil([]);
    expect(p).toMatchObject({
      estiloPredominante: null,
      estilosEmpatados: [],
      flexibilidade: null,
      flexibilidadePct: null,
      nEscolhas: 0,
      testesConsiderados: 0,
      testesAguardandoValidacao: 0,
      distribuicao: { direcao: 0, orientacao: 0, apoio: 0, delegacao: 0 }
    });
  });
});

describe("skills (radar)", () => {
  const porId = (linhas: LinhaDeSkill[]) =>
    Object.fromEntries(montarPainel(dados({ skills: linhas })).skills.map((s) => [s.skillId, s]));

  it("o nível exibido é o calculado quando o curador ainda não revisou, com o selo", () => {
    const s = porId([skill({ skillId: "gestao-os", nivel: 4, nEvidencias: 3 })])["gestao-os"]!;
    expect(s).toMatchObject({
      nivel: 4,
      nivelCalculado: 4,
      validado: false,
      nEvidencias: 3,
      resultadoId: "r-1",
      sessaoId: "s-1",
      atualizadoEm: t("2026-03-02T10:10:00Z")
    });
  });

  it("depois da revisão, o exibido é o do curador e o calculado continua visível", () => {
    const s = porId([skill({ skillId: "delegacao", nivel: 4, validado: true, nivelValidado: 2 })])[
      "delegacao"
    ]!;
    expect(s).toMatchObject({ nivel: 2, nivelCalculado: 4, validado: true });
  });

  it("revisado sem ajuste: o mesmo nível, agora validado", () => {
    const s = porId([skill({ skillId: "delegacao", nivel: 3, validado: true, nivelValidado: 3 })])[
      "delegacao"
    ]!;
    expect(s).toMatchObject({ nivel: 3, nivelCalculado: 3, validado: true });
  });

  it("'validado' sem nível validado é inconsistente e não vale como validado", () => {
    const s = porId([
      skill({ skillId: "delegacao", nivel: 3, validado: true, nivelValidado: null })
    ])["delegacao"]!;
    expect(s).toMatchObject({ nivel: 3, validado: false });
  });

  it("as skills sem evidência seguem no radar, sem nível; uma skill desconhecida é ignorada", () => {
    const skills = montarPainel(
      dados({ skills: [skill({ skillId: "gestao-os" }), skill({ skillId: "skill-do-futuro" })] })
    ).skills;
    expect(skills).toHaveLength(8);
    expect(skills.find((s) => s.skillId === "gestao-os")?.nivel).toBe(3);
    expect(skills.find((s) => s.skillId === "contingencia")?.nivel).toBeNull();
    expect(skills.some((s) => s.skillId === "skill-do-futuro")).toBe(false);
  });
});

describe("alertas", () => {
  const montar = (linhas: LinhaDeAlerta[]) => montarPainel(dados({ alertas: linhas })).alertas;

  it("vermelhos primeiro; dentro de cada cor, os mais recentes", () => {
    const alertas = montar([
      alerta({
        id: "amarelo-velho",
        cor: "amarelo",
        skillId: "gestao-os",
        skillNome: "Gestão de OS",
        situacao: null,
        criadoEm: t("2026-03-01T10:00:00Z")
      }),
      alerta({ id: "vermelho-velho", criadoEm: t("2026-03-01T11:00:00Z") }),
      alerta({
        id: "amarelo-novo",
        cor: "amarelo",
        skillId: "delegacao",
        skillNome: "Delegação",
        situacao: null,
        criadoEm: t("2026-03-04T10:00:00Z")
      }),
      alerta({ id: "vermelho-novo", criadoEm: t("2026-03-04T11:00:00Z") })
    ]);
    expect(alertas.map((a) => a.id)).toEqual([
      "vermelho-novo",
      "vermelho-velho",
      "amarelo-novo",
      "amarelo-velho"
    ]);
  });

  it("o vermelho é de uma situação; o amarelo, de uma skill", () => {
    const [vermelho, amarelo] = montar([
      alerta({ id: "v", situacao: 3 }),
      alerta({
        id: "a",
        cor: "amarelo",
        skillId: "gestao-os",
        skillNome: "Gestão de OS e prioridades",
        situacao: null
      })
    ]);
    expect(vermelho).toMatchObject({ cor: "vermelho", situacao: 3, skill: null });
    expect(amarelo).toMatchObject({
      cor: "amarelo",
      situacao: null,
      skill: { id: "gestao-os", nome: "Gestão de OS e prioridades" }
    });
    expect(vermelho!.teste).toEqual({
      sessaoId: "s-1",
      resultadoId: "r-1",
      concluidaEm: t("2026-03-02T10:10:00Z")
    });
  });

  it("ignora cor desconhecida e respeita o teto de proteção", () => {
    expect(montar([alerta({ id: "x", cor: "azul" })])).toEqual([]);
    const muitos = Array.from({ length: LIMITES_DO_PAINEL.alertas + 20 }, (_, i) =>
      alerta({ id: `a${i}` })
    );
    expect(montar(muitos)).toHaveLength(LIMITES_DO_PAINEL.alertas);
  });
});

describe("sugestões", () => {
  const ultimo = (sugestoes: unknown) => ({
    resultadoId: "r-9",
    sessaoId: "s-9",
    concluidaEm: t("2026-03-09T10:00:00Z"),
    statusValidacao: "aguardando_validacao",
    sugestoes
  });
  const itens = (sugestoes: unknown) =>
    montarPainel(dados({ ultimoResultado: ultimo(sugestoes) })).sugestoes.itens;

  it("até 3, na ordem, as do teste mais recente, com a origem", () => {
    const s = montarPainel(dados({ ultimoResultado: ultimo(["a", "b", "c", "d", "e"]) })).sugestoes;
    expect(s.itens).toEqual(["a", "b", "c"]);
    expect(s.origem).toEqual({
      resultadoId: "r-9",
      sessaoId: "s-9",
      concluidaEm: t("2026-03-09T10:00:00Z"),
      statusValidacao: "aguardando_validacao"
    });
  });

  it("apara e descarta textos em branco antes de contar o limite", () => {
    expect(itens(["  primeira  ", "", "   ", "segunda"])).toEqual(["primeira", "segunda"]);
    expect(itens(["", "", "a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
  });

  it("dado que não é uma lista de textos vira lista vazia, sem derrubar o painel", () => {
    for (const ruim of [null, "texto", { a: 1 }, [1, 2], 5]) {
      expect(itens(ruim)).toEqual([]);
    }
  });

  it("sem resultado, não há origem", () => {
    expect(montarPainel(dados()).sugestoes).toEqual({ itens: [], origem: null });
  });
});

describe("evolução", () => {
  it("mantém a ordem cronológica recebida e carrega o selo de validação e quantas escolhas sustentam cada ponto", () => {
    const p = montarPainel(
      comTestes(2, {
        resultados: [
          {
            resultadoId: "r1",
            sessaoId: "s1",
            concluidaEm: t("2026-03-01T10:00:00Z"),
            aderenciaGeral: 60,
            agilidade: 70,
            statusValidacao: "validado",
            nSituacoes: 5
          },
          {
            resultadoId: "r2",
            sessaoId: "s2",
            concluidaEm: t("2026-03-03T10:00:00Z"),
            aderenciaGeral: 80,
            agilidade: 75,
            statusValidacao: "aguardando_validacao",
            nSituacoes: 5
          }
        ]
      })
    );
    expect(
      p.evolucao.pontos.map((x) => [
        x.resultadoId,
        x.aderenciaGeral,
        x.statusValidacao,
        x.nSituacoes
      ])
    ).toEqual([
      ["r1", 60, "validado", 5],
      ["r2", 80, "aguardando_validacao", 5]
    ]);
  });
});

describe("nada além do que o painel declara sai da montagem", () => {
  it("campos a mais nas linhas de entrada (avaliação, justificativa, resposta da IA) não chegam à resposta", () => {
    // Cada linha de entrada ganha campos que NÃO são do painel; nenhum pode aparecer na resposta.
    const segredo = <L extends object>(linha: L) => ({
      ...linha,
      justificativa: "SEGREDO",
      respostaIa: "SEGREDO",
      estiloDaSituacao: "SEGREDO",
      processandoAte: "SEGREDO"
    });
    const instante = t("2026-03-01T10:00:00Z");
    const p = montarPainel(
      comTestes(3, {
        resultados: [
          segredo({
            resultadoId: "r1",
            sessaoId: "s1",
            concluidaEm: instante,
            aderenciaGeral: 60,
            agilidade: 70,
            statusValidacao: "validado",
            nSituacoes: 5
          })
        ],
        skills: [segredo(skill({ skillId: "gestao-os" }))],
        escolhasDeEstilo: [segredo(escolha("a", "apoio"))],
        alertas: [segredo(alerta({ id: "x" }))],
        ultimoResultado: segredo({
          resultadoId: "r1",
          sessaoId: "s1",
          concluidaEm: instante,
          statusValidacao: "validado",
          sugestoes: ["ok"]
        })
      })
    );
    expect(JSON.stringify(p)).not.toContain("SEGREDO");
  });

  it("as chaves de cada bloco são exatamente as declaradas", () => {
    const p = montarPainel(comTestes(3, { escolhasDeEstilo: [escolha("a", "apoio")] }));
    expect(Object.keys(p).sort()).toEqual([
      "acao",
      "alertas",
      "demonstracao",
      "evolucao",
      "indicadores",
      "skills",
      "sugestoes",
      "termo",
      "tipoDePerfil"
    ]);
    expect(Object.keys(p.indicadores).sort()).toEqual([
      "aderenciaMedia",
      "agilidadeMedia",
      "testesFeitos",
      "testesValidados",
      "ultimoTesteEm"
    ]);
    expect(Object.keys(p.skills[0]!).sort()).toEqual([
      "atualizadoEm",
      "nEvidencias",
      "nivel",
      "nivelCalculado",
      "nome",
      "resultadoId",
      "sessaoId",
      "skillId",
      "tipo",
      "validado"
    ]);
    expect(Object.keys(p.tipoDePerfil).sort()).toEqual([
      "disponivel",
      "distribuicao",
      "estiloPredominante",
      "estilosEmpatados",
      "flexibilidade",
      "flexibilidadePct",
      "nEscolhas",
      "testesAguardandoValidacao",
      "testesConsiderados"
    ]);
  });

  it("o modo demonstração é só um sinal: liga e desliga sem mudar mais nada no painel", () => {
    const normal = montarPainel(dados({ demonstracao: false }));
    const demonstracao = montarPainel(dados({ demonstracao: true }));
    expect(normal.demonstracao).toBe(false);
    expect(demonstracao.demonstracao).toBe(true);
    expect({ ...demonstracao, demonstracao: false }).toEqual(normal);
  });
});
