// O assistente de suporte para o perfil COMUM: só o Leadership Lab e os resultados da própria pessoa.
// Unitário, com banco e IA falsos: confere o que a API manda à IA (escopo, cargo/nível/área, dados) e
// o que NÃO manda. A restrição vale no servidor: a IA só recebe o escopo "lab" e os dados da conta que
// perguntou; nada de colaboradores, escalas ou de outra pessoa chega ao contexto.
import type { AuthenticatedUser } from "@my-flux/types";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IaFalsa } from "../leadership-lab/motor/ia-falsa.js";
import { configDeTeste } from "../leadership-lab/motor/cenario-de-teste.js";
import { MotorDoTeste, pessoaDaConta } from "../leadership-lab/motor/motor.js";
import { consultarPainel } from "../leadership-lab/painel/consulta.js";
import type { PainelDoParticipante } from "../leadership-lab/painel/tipos.js";
import { resumirMeusResultados, resumoSemResultados } from "./meus-resultados.js";
import { RESPOSTA_FORA_DO_ESCOPO } from "./suporte-dados.js";

vi.mock("../leadership-lab/painel/consulta.js", () => ({ consultarPainel: vi.fn() }));
const painelDe = vi.mocked(consultarPainel);

const PAINEL = {
  demonstracao: false,
  termo: { versaoAtual: "1", aceito: true, aceitoEm: new Date("2026-11-01T10:00:00Z") },
  acao: { tipo: "iniciar" },
  indicadores: {
    testesFeitos: 2,
    testesValidados: 1,
    aderenciaMedia: 71.5,
    agilidadeMedia: 60,
    ultimoTesteEm: new Date("2026-11-10T12:00:00Z")
  },
  evolucao: {
    pontos: [
      {
        resultadoId: "res-aaa",
        sessaoId: "ses-aaa",
        concluidaEm: new Date("2026-11-05T12:00:00Z"),
        aderenciaGeral: 65,
        agilidade: 50,
        statusValidacao: "validado",
        nSituacoes: 5
      },
      {
        resultadoId: "res-bbb",
        sessaoId: "ses-bbb",
        concluidaEm: new Date("2026-11-10T12:00:00Z"),
        aderenciaGeral: 78,
        agilidade: 70,
        statusValidacao: "aguardando_validacao",
        nSituacoes: 5
      }
    ],
    tendenciaDisponivel: false
  },
  skills: [
    {
      skillId: "comunicacao",
      nome: "Comunicação",
      tipo: "soft",
      nivel: 3,
      nivelCalculado: 3,
      validado: true,
      nEvidencias: 4,
      resultadoId: "res-aaa",
      sessaoId: "ses-aaa",
      atualizadoEm: new Date("2026-11-10T12:00:00Z")
    },
    {
      skillId: "delegacao",
      nome: "Delegação",
      tipo: "soft",
      nivel: null,
      nivelCalculado: null,
      validado: false,
      nEvidencias: 0,
      resultadoId: null,
      sessaoId: null,
      atualizadoEm: null
    }
  ],
  tipoDePerfil: { disponivel: false, testesFeitos: 2, testesNecessarios: 3 },
  alertas: [
    {
      id: "alerta-1",
      cor: "amarelo",
      criadoEm: new Date("2026-11-10T12:00:00Z"),
      skill: { id: "comunicacao", nome: "Comunicação" },
      situacao: null,
      teste: { sessaoId: "ses-bbb", resultadoId: "res-bbb", concluidaEm: null }
    }
  ],
  sugestoes: { itens: ["Treine a escuta ativa."], origem: null }
} as unknown as PainelDoParticipante;

const usuario = (
  role: AuthenticatedUser["role"],
  extra: Partial<AuthenticatedUser> = {}
): AuthenticatedUser =>
  ({
    id: `u-${role}`,
    email: "pessoa@empresa.com",
    name: "Pessoa Secreta",
    role,
    scopes: [{ isGlobal: true }],
    cargo: "Supervisor de manutenção",
    nivelGovernanca: "supervisor",
    area: { id: "area-1", nome: "Manutenção" },
    ...extra
  }) as AuthenticatedUser;

const ator = (role: AuthenticatedUser["role"], participanteId: string | null = "p-1") => ({
  userId: `u-${role}`,
  role,
  participanteId,
  permissoes: []
});

const ENTRADA = (mensagem: string, caminho = "/lab") => ({
  mensagem,
  historico: [],
  pagina: { caminho, titulo: "Leadership Lab" }
});

function bancoFalso() {
  return {
    employee: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    operation: { findMany: vi.fn() },
    jobFunction: { findMany: vi.fn() },
    calendarEvent: { count: vi.fn(), findMany: vi.fn() },
    scheduleVersion: { findMany: vi.fn() },
    labSessao: { findFirst: vi.fn().mockResolvedValue(null) },
    labLogIa: { create: vi.fn().mockResolvedValue({}) }
  };
}
const aviso = { warn: vi.fn(), info: vi.fn() };

function montar() {
  const b = bancoFalso();
  const ia = new IaFalsa();
  ia.respostaDoSuporte = "Resposta do assistente";
  const motor = new MotorDoTeste({
    db: b as unknown as PrismaClient,
    ia,
    config: configDeTeste(),
    logger: aviso
  });
  return { b, ia, motor };
}

const corpoEnviado = (ia: IaFalsa, n = 0) => JSON.parse(ia.corposPorAlvo.suporte[n]!);
const naoTocouEmDadosDaEmpresa = (b: ReturnType<typeof bancoFalso>) => {
  expect(b.employee.groupBy).not.toHaveBeenCalled();
  expect(b.employee.findMany).not.toHaveBeenCalled();
  expect(b.employee.count).not.toHaveBeenCalled();
  expect(b.scheduleVersion.findMany).not.toHaveBeenCalled();
  expect(b.calendarEvent.findMany).not.toHaveBeenCalled();
};

beforeEach(() => {
  painelDe.mockReset();
  painelDe.mockResolvedValue(PAINEL);
  aviso.info.mockReset();
  aviso.warn.mockReset();
});

describe("assistente: o escopo e a pessoa que vão à IA", () => {
  it("o COMUM vai com escopo lab e com cargo, nível de governança e área da conta", async () => {
    const { ia, motor } = montar();
    await motor.suporte(ator("COMUM"), usuario("COMUM"), ENTRADA("Como funciona o teste?"));
    expect(corpoEnviado(ia)).toMatchObject({
      perfil: "COMUM",
      escopo: "lab",
      pessoa: {
        cargo: "Supervisor de manutenção",
        nivel_governanca: "supervisor",
        area: "Manutenção"
      }
    });
  });

  it("nada de identificação vai junto: nem nome, nem e-mail, nem ids da conta", async () => {
    const { ia, motor } = montar();
    await motor.suporte(ator("COMUM"), usuario("COMUM"), ENTRADA("Como funciona o teste?"));
    const bruto = ia.corposPorAlvo.suporte[0]!;
    expect(bruto).not.toContain("Pessoa Secreta");
    expect(bruto).not.toContain("pessoa@empresa.com");
    expect(bruto).not.toContain("u-COMUM");
    expect(bruto).not.toContain("area-1");
  });

  it("conta com cadastro incompleto: escopo lab, mas sem o bloco da pessoa", async () => {
    const { ia, motor } = montar();
    await motor.suporte(
      ator("COMUM"),
      usuario("COMUM", { cargo: null, nivelGovernanca: null, area: null }),
      ENTRADA("Como funciona o teste?")
    );
    const corpo = corpoEnviado(ia);
    expect(corpo.escopo).toBe("lab");
    expect(corpo).not.toHaveProperty("pessoa");
  });

  it.each(["DEV", "ADMIN", "RH"] as const)(
    "%s segue sem limite: nenhum escopo é enviado (a IA usa o guia completo)",
    async (perfil) => {
      const { ia, motor } = montar();
      await motor.suporte(
        ator(perfil, null),
        usuario(perfil),
        ENTRADA("Como gero a escala?", "/escalas")
      );
      const corpo = corpoEnviado(ia);
      expect(corpo).not.toHaveProperty("escopo");
      expect(corpo.perfil).toBe(perfil);
      expect(corpo.pessoa).toMatchObject({ area: "Manutenção" });
    }
  );

  it("pessoaDaConta exige os três campos", () => {
    expect(pessoaDaConta(usuario("COMUM"))).toEqual({
      cargo: "Supervisor de manutenção",
      nivel_governanca: "supervisor",
      area: "Manutenção"
    });
    for (const faltando of [{ cargo: null }, { nivelGovernanca: null }, { area: null }] as const)
      expect(pessoaDaConta(usuario("COMUM", faltando))).toBeNull();
  });
});

describe("assistente: o COMUM recebe recusa fora do Lab", () => {
  it("a IA recusa o assunto: resposta fixa da API, uma só chamada, nenhum dado da empresa consultado", async () => {
    const { b, ia, motor } = montar();
    ia.foraDoEscopoNoSuporte = true;
    const r = await motor.suporte(
      ator("COMUM"),
      usuario("COMUM"),
      ENTRADA("Como gero a escala de novembro?")
    );
    expect(r).toEqual({ desfecho: "fora_do_escopo", resposta: RESPOSTA_FORA_DO_ESCOPO });
    expect(r.resposta).toMatch(/RH/);
    expect(ia.chamadas.suporte).toBe(1);
    naoTocouEmDadosDaEmpresa(b);
    expect(painelDe).not.toHaveBeenCalled();
  });

  it.each(["desligados_recentes", "resumo_colaboradores", "escalas_recentes"] as const)(
    "a IA pede %s para o COMUM: a API nega, não consulta e a IA nunca vê o dado",
    async (consulta) => {
      const { b, ia, motor } = montar();
      ia.consultaDoSuporte = consulta;
      const r = await motor.suporte(
        ator("COMUM"),
        usuario("COMUM"),
        ENTRADA("Quem foi desligado recentemente?")
      );
      expect(r).toEqual({ desfecho: "fora_do_escopo", resposta: RESPOSTA_FORA_DO_ESCOPO });
      expect(ia.chamadas.suporte).toBe(1);
      naoTocouEmDadosDaEmpresa(b);
      expect(painelDe).not.toHaveBeenCalled();
    }
  );

  it("pergunta do Lab é respondida normalmente", async () => {
    const { ia, motor } = montar();
    const r = await motor.suporte(
      ator("COMUM"),
      usuario("COMUM"),
      ENTRADA("O que é o termo de ciência?")
    );
    expect(r.desfecho).toBe("respondida");
    expect(ia.chamadas.suporte).toBe(1);
  });
});

describe("assistente: meus_resultados", () => {
  it("o COMUM pergunta do próprio resultado: o painel é o do vínculo dele e a segunda chamada leva o resumo", async () => {
    const { b, ia, motor } = montar();
    ia.consultaDoSuporte = "meus_resultados";
    const r = await motor.suporte(
      ator("COMUM", "p-1"),
      usuario("COMUM"),
      ENTRADA("Qual foi o meu resultado?")
    );
    expect(r.desfecho).toBe("respondida");
    expect(r.resposta).toContain("Resposta do assistente");
    expect(ia.chamadas.suporte).toBe(2);
    expect(painelDe).toHaveBeenCalledTimes(1);
    expect(painelDe.mock.calls[0]![1]).toMatchObject({ participanteId: "p-1" });
    naoTocouEmDadosDaEmpresa(b);

    const segundo = corpoEnviado(ia, 1);
    expect(segundo.escopo).toBe("lab");
    expect(segundo.dados.consulta).toBe("meus_resultados");
    expect(segundo.dados.resultado).toMatchObject({
      resultados_disponiveis: true,
      testes_feitos: 2,
      aderencia_media: 71.5
    });
    // Sem identificação: nenhum id de resultado/teste/alerta, nem dados da conta.
    const bruto = JSON.stringify(segundo.dados);
    for (const proibido of [
      "res-aaa",
      "res-bbb",
      "ses-aaa",
      "alerta-1",
      "Pessoa Secreta",
      "u-COMUM"
    ])
      expect(bruto).not.toContain(proibido);
    expect(aviso.info).toHaveBeenCalledWith(
      { userId: "u-COMUM", perfil: "COMUM", consulta: "meus_resultados" },
      "suporte: consulta dos próprios resultados"
    );
  });

  it("sem vínculo com um colaborador: não lê painel nenhum e a IA recebe 'sem_vinculo'", async () => {
    const { ia, motor } = montar();
    ia.consultaDoSuporte = "meus_resultados";
    await motor.suporte(
      ator("COMUM", null),
      usuario("COMUM"),
      ENTRADA("Qual foi o meu resultado?")
    );
    expect(painelDe).not.toHaveBeenCalled();
    expect(corpoEnviado(ia, 1).dados.resultado).toMatchObject({
      resultados_disponiveis: false,
      motivo: "sem_vinculo"
    });
  });

  it("o DEV também pode ver o dele (e só o dele)", async () => {
    const { ia, motor } = montar();
    ia.consultaDoSuporte = "meus_resultados";
    await motor.suporte(
      ator("DEV", "p-dev"),
      usuario("DEV"),
      ENTRADA("Qual foi o meu resultado?", "/lab")
    );
    expect(painelDe.mock.calls[0]![1]).toMatchObject({ participanteId: "p-dev" });
    expect(corpoEnviado(ia, 1)).not.toHaveProperty("escopo");
  });

  it("falha ao ler o painel: resposta amigável, sem expor o erro", async () => {
    const { ia, motor } = montar();
    ia.consultaDoSuporte = "meus_resultados";
    painelDe.mockRejectedValue(new Error("connection refused 10.0.0.5"));
    const r = await motor.suporte(
      ator("COMUM"),
      usuario("COMUM"),
      ENTRADA("Qual foi o meu resultado?")
    );
    expect(r.resposta).toBe(
      "Não consegui consultar os seus resultados agora. Tente de novo em instantes."
    );
    expect(ia.chamadas.suporte).toBe(1);
  });
});

describe("resumo dos próprios resultados", () => {
  it("traz os números que o sistema calculou, do mais antigo ao mais novo, e só o que tem evidência", () => {
    const r = resumirMeusResultados(PAINEL, 5) as Record<string, unknown>;
    expect(r).toMatchObject({
      resultados_disponiveis: true,
      testes_feitos: 2,
      testes_validados_pelo_rh: 1,
      ultimo_teste_em: "2026-11-10"
    });
    expect(r.testes_recentes).toEqual([
      {
        concluido_em: "2026-11-05",
        aderencia_geral: 65,
        agilidade: 50,
        situacoes: 5,
        validado_pelo_rh: true
      },
      {
        concluido_em: "2026-11-10",
        aderencia_geral: 78,
        agilidade: 70,
        situacoes: 5,
        validado_pelo_rh: false
      }
    ]);
    expect(r.nivel_por_competencia).toEqual([
      { competencia: "Comunicação", nivel_de_1_a_5: 3, validado_pelo_rh: true }
    ]);
    expect(r.perfil_de_lideranca).toEqual({
      disponivel: false,
      testes_feitos: 2,
      testes_necessarios: 3
    });
  });

  it("o limite pega os testes mais recentes", () => {
    const r = resumirMeusResultados(PAINEL, 1) as {
      testes_recentes: { aderencia_geral: number }[];
    };
    expect(r.testes_recentes.map((t) => t.aderencia_geral)).toEqual([78]);
  });

  it("sem testes concluídos ou sem vínculo, diz isso", () => {
    const vazio = {
      ...PAINEL,
      indicadores: { ...PAINEL.indicadores, testesFeitos: 0 }
    } as PainelDoParticipante;
    expect(resumirMeusResultados(vazio, 5)).toMatchObject({
      resultados_disponiveis: false,
      motivo: "sem_testes"
    });
    expect(resumoSemResultados("sem_vinculo")).toMatchObject({ motivo: "sem_vinculo" });
  });
});

describe("assistente: o estado do serviço de IA", () => {
  it("sem os recursos novos do contrato, o serviço é 'desatualizado' (o COMUM falharia fechado)", async () => {
    const { ia, motor } = montar();
    ia.saude = async () => ({ versao_instrucao: "v1", agentes: ["facilitador", "suporte"] });
    const antigo = await motor.estadoDoSuporte();
    expect(antigo.estado).toBe("desatualizado");
    expect(antigo.detalhe).toMatch(/escopo.*pessoa.*meus_resultados.*fora_do_escopo/);
    ia.saude = async () => ({
      versao_instrucao: "v2",
      agentes: ["facilitador", "suporte"],
      recursos_suporte: ["escopo", "pessoa", "meus_resultados", "fora_do_escopo"]
    });
    expect(await motor.estadoDoSuporte()).toMatchObject({ estado: "ok", versao: "v2" });
  });
});
