// Matriz completa de can(): todos os pares ator × alvo × ação, contra tabelas escritas à mão (a
// especificação do Prompt 2, seção 1), mais as varreduras dos invariantes que não podem quebrar.
import { describe, expect, it } from "vitest";
import {
  acoesDeAcesso,
  can,
  decidirAcesso,
  perfilGerencia,
  perfisDeAcesso,
  politicaDoAssistente,
  statusHttpDaNegacao,
  type AtorDeAcesso,
  type MotivoDaNegacao,
  type OrigemDoResultado,
  type PerfilDeAcesso as P
} from "./acessos.js";
import type { ModuloDef } from "./modules.js";

const eu = (role: P): AtorDeAcesso => ({ id: `eu-${role}`, role });
const outro = "outra-pessoa";
const perfis = perfisDeAcesso;

/** Quem gerencia quem (a coluna é o perfil do alvo): a especificação, em tabela. */
const GERENCIA: Record<P, Record<P, boolean>> = {
  DEV: { DEV: true, ADMIN: true, RH: true, COMUM: true },
  ADMIN: { DEV: false, ADMIN: false, RH: true, COMUM: true },
  RH: { DEV: false, ADMIN: false, RH: false, COMUM: true },
  COMUM: { DEV: false, ADMIN: false, RH: false, COMUM: false }
};

describe("gestão de usuários: criar, editar, desativar, remover e trocar perfil", () => {
  it("perfilGerencia, criar e editar seguem a tabela (4 × 4)", () => {
    for (const ator of perfis)
      for (const alvo of perfis) {
        const esperado = GERENCIA[ator][alvo];
        expect(perfilGerencia(ator, alvo), `${ator}→${alvo}`).toBe(esperado);
        expect(can(eu(ator), "usuario:criar", { perfil: alvo }), `criar ${ator}→${alvo}`).toBe(
          esperado
        );
        expect(
          can(eu(ator), "usuario:editar", { id: outro, perfil: alvo }),
          `editar ${ator}→${alvo}`
        ).toBe(esperado);
      }
  });

  it("trocar perfil: 4 atores × 4 perfis atuais × 4 novos × própria conta × 1 ou 2 DEV ativos", () => {
    for (const ator of perfis)
      for (const atual of perfis)
        for (const novo of perfis)
          for (const proprio of [false, true])
            for (const devsAtivos of [1, 2]) {
              const alvo = {
                id: proprio ? eu(ator).id : outro,
                perfil: atual,
                novoPerfil: novo,
                devsAtivos
              };
              // A regra, passo a passo: própria conta nunca; hierarquia no perfil atual E no novo;
              // o último DEV não deixa de ser DEV.
              const esperado =
                !proprio &&
                GERENCIA[ator][atual] &&
                GERENCIA[ator][novo] &&
                !(atual === "DEV" && novo !== "DEV" && devsAtivos <= 1);
              expect(
                can(eu(ator), "usuario:alterar-perfil", alvo),
                `${ator} troca ${atual}→${novo} proprio=${proprio} devs=${devsAtivos}`
              ).toBe(esperado);
            }
  });

  it("desativar e remover: hierarquia, nunca a própria conta, e o último DEV fica", () => {
    for (const acao of ["usuario:desativar", "usuario:remover"] as const)
      for (const ator of perfis)
        for (const alvoPerfil of perfis)
          for (const proprio of [false, true])
            for (const devsAtivos of [1, 2]) {
              const alvo = { id: proprio ? eu(ator).id : outro, perfil: alvoPerfil, devsAtivos };
              const esperado =
                !proprio &&
                GERENCIA[ator][alvoPerfil] &&
                !(alvoPerfil === "DEV" && devsAtivos <= 1);
              expect(
                can(eu(ator), acao, alvo),
                `${acao} ${ator}→${alvoPerfil} proprio=${proprio} devs=${devsAtivos}`
              ).toBe(esperado);
            }
  });

  it("os motivos da negação: própria conta, último DEV e hierarquia", () => {
    const motivo = (
      ator: P,
      alvo: Parameters<typeof decidirAcesso<"usuario:alterar-perfil">>[2]
    ) => {
      const d = decidirAcesso(eu(ator), "usuario:alterar-perfil", alvo);
      return d.permitido ? "ok" : d.motivo;
    };
    expect(
      motivo("DEV", { id: eu("DEV").id, perfil: "DEV", novoPerfil: "ADMIN", devsAtivos: 3 })
    ).toBe("proprio");
    expect(motivo("DEV", { id: outro, perfil: "DEV", novoPerfil: "RH", devsAtivos: 1 })).toBe(
      "ultimo-dev"
    );
    expect(motivo("ADMIN", { id: outro, perfil: "RH", novoPerfil: "ADMIN", devsAtivos: 2 })).toBe(
      "perfil"
    );
    expect(motivo("DEV", { id: outro, perfil: "RH", novoPerfil: "ADMIN", devsAtivos: 1 })).toBe(
      "ok"
    );
  });
});

describe("Leadership Lab: fazer o teste e ver resultados", () => {
  const donos: { donoPerfil: P; origem: OrigemDoResultado }[] = [
    { donoPerfil: "COMUM", origem: "participante" },
    { donoPerfil: "RH", origem: "interno" },
    { donoPerfil: "ADMIN", origem: "interno" },
    { donoPerfil: "DEV", origem: "interno" }
  ];

  it("todos os perfis fazem o teste", () => {
    for (const ator of perfis) expect(can(eu(ator), "lab:fazer-teste", undefined)).toBe(true);
  });

  it("ver resultado: o próprio sempre; de outro, só a equipe (de COMUM e interno); COMUM nunca vê alheio", () => {
    for (const ator of perfis)
      for (const { donoPerfil, origem } of donos)
        for (const proprio of [true, false]) {
          const alvo = { donoId: proprio ? eu(ator).id : outro, donoPerfil, origem };
          const esperado = proprio || ator !== "COMUM";
          expect(
            can(eu(ator), "lab:ver-resultado", alvo),
            `${ator} vê ${origem}/${donoPerfil} proprio=${proprio}`
          ).toBe(esperado);
        }
  });

  it("o motivo de COMUM ver o de outra pessoa é 'alheio' (404, não revela que existe)", () => {
    const d = decidirAcesso(eu("COMUM"), "lab:ver-resultado", {
      donoId: outro,
      donoPerfil: "RH",
      origem: "interno"
    });
    expect(d).toEqual({ permitido: false, motivo: "alheio" });
    expect(statusHttpDaNegacao("alheio")).toBe(404);
  });

  it("validar resultado: só RH e DEV, só de participante, nunca o próprio", () => {
    const valida: Record<P, boolean> = { DEV: true, ADMIN: false, RH: true, COMUM: false };
    for (const ator of perfis)
      for (const { donoPerfil, origem } of donos)
        for (const proprio of [true, false]) {
          const alvo = { donoId: proprio ? eu(ator).id : outro, donoPerfil, origem };
          const esperado = valida[ator] && origem === "participante" && !proprio;
          expect(
            can(eu(ator), "lab:validar-resultado", alvo),
            `${ator} valida ${origem} proprio=${proprio}`
          ).toBe(esperado);
        }
  });

  it("contestar: só o COMUM, só o próprio resultado de participante", () => {
    for (const ator of perfis)
      for (const { donoPerfil, origem } of donos)
        for (const proprio of [true, false]) {
          const alvo = { donoId: proprio ? eu(ator).id : outro, donoPerfil, origem };
          const esperado = ator === "COMUM" && origem === "participante" && proprio;
          expect(
            can(eu(ator), "lab:contestar", alvo),
            `${ator} contesta ${origem} proprio=${proprio}`
          ).toBe(esperado);
        }
  });

  it("decidir contestação: RH, ADMIN e DEV, de participante, nunca a própria", () => {
    const decide: Record<P, boolean> = { DEV: true, ADMIN: true, RH: true, COMUM: false };
    for (const ator of perfis)
      for (const { donoPerfil, origem } of donos)
        for (const proprio of [true, false]) {
          const alvo = { donoId: proprio ? eu(ator).id : outro, donoPerfil, origem };
          const esperado = decide[ator] && origem === "participante" && !proprio;
          expect(
            can(eu(ator), "lab:decidir-contestacao", alvo),
            `${ator} decide ${origem} proprio=${proprio}`
          ).toBe(esperado);
        }
  });

  it("dados incoerentes (interno de COMUM, participante da equipe) são negados por segurança", () => {
    const incoerentes = [
      { donoPerfil: "COMUM" as P, origem: "interno" as OrigemDoResultado },
      { donoPerfil: "RH" as P, origem: "participante" as OrigemDoResultado },
      { donoPerfil: "DEV" as P, origem: "participante" as OrigemDoResultado }
    ];
    for (const acao of [
      "lab:ver-resultado",
      "lab:validar-resultado",
      "lab:contestar",
      "lab:decidir-contestacao"
    ] as const)
      for (const ator of perfis)
        for (const { donoPerfil, origem } of incoerentes) {
          const d = decidirAcesso(eu(ator), acao, { donoId: outro, donoPerfil, origem });
          expect(d, `${acao} ${ator}`).toEqual({ permitido: false, motivo: "alvo-invalido" });
        }
  });

  it("áreas: a equipe lê; só DEV e ADMIN editam", () => {
    const le: Record<P, boolean> = { DEV: true, ADMIN: true, RH: true, COMUM: false };
    const edita: Record<P, boolean> = { DEV: true, ADMIN: true, RH: false, COMUM: false };
    for (const ator of perfis) {
      expect(can(eu(ator), "area:ler", undefined), `ler área ${ator}`).toBe(le[ator]);
      expect(can(eu(ator), "area:editar", undefined), `editar área ${ator}`).toBe(edita[ator]);
    }
  });

  it("acompanhamento e configuração de treinamentos", () => {
    const equipe: Record<P, boolean> = { DEV: true, ADMIN: true, RH: true, COMUM: false };
    const edita: Record<P, boolean> = { DEV: true, ADMIN: true, RH: false, COMUM: false };
    for (const ator of perfis) {
      expect(can(eu(ator), "lab:ver-acompanhamento", undefined), `acompanhar ${ator}`).toBe(
        equipe[ator]
      );
      expect(can(eu(ator), "treinamento:ler-config", undefined), `ler config ${ator}`).toBe(
        equipe[ator]
      );
      expect(can(eu(ator), "treinamento:editar-config", undefined), `editar config ${ator}`).toBe(
        edita[ator]
      );
      expect(can(eu(ator), "treinamento:aprovar", undefined), `aprovar ${ator}`).toBe(edita[ator]);
    }
  });
});

describe("módulos: visíveis, ocultos e do COMUM", () => {
  const def = (id: string, extra: Partial<ModuloDef> = {}): ModuloDef => ({
    id,
    rotulo: id,
    status: "active",
    comumPode: false,
    rotasWeb: [`/${id}`],
    apiPrefixos: [],
    ...extra
  });
  const registro: Record<string, ModuloDef> = {
    lab: def("lab", { comumPode: true }),
    escalas: def("escalas"),
    qlp: def("qlp", { status: "hidden" }),
    // Um módulo oculto que o COMUM "poderia" ver: oculto vence tudo.
    escondidoDoComum: def("escondidoDoComum", { status: "hidden", comumPode: true })
  };

  it("oculto: negado a TODOS os perfis, na leitura e na escrita, com motivo de 404", () => {
    for (const id of ["qlp", "escondidoDoComum"])
      for (const ator of perfis)
        for (const acao of ["modulo:ver", "modulo:escrever"] as const)
          expect(
            decidirAcesso(eu(ator), acao, { moduloId: id }, registro),
            `${acao} ${id} ${ator}`
          ).toEqual({
            permitido: false,
            motivo: "modulo-oculto"
          });
  });

  it("ativo: a equipe vê e escreve; o COMUM só vê o que o registro libera (o Lab) e não escreve", () => {
    for (const ator of perfis) {
      const equipe = ator !== "COMUM";
      expect(
        can(eu(ator), "modulo:ver", { moduloId: "escalas" }, registro),
        `ver escalas ${ator}`
      ).toBe(equipe);
      expect(
        can(eu(ator), "modulo:escrever", { moduloId: "escalas" }, registro),
        `escrever escalas ${ator}`
      ).toBe(equipe);
      expect(can(eu(ator), "modulo:ver", { moduloId: "lab" }, registro), `ver lab ${ator}`).toBe(
        true
      );
      expect(
        can(eu(ator), "modulo:escrever", { moduloId: "lab" }, registro),
        `escrever lab ${ator}`
      ).toBe(equipe);
    }
  });

  it("módulo desconhecido é negado com 404 (nunca vira 'liberado por engano')", () => {
    for (const ator of perfis)
      expect(decidirAcesso(eu(ator), "modulo:ver", { moduloId: "nao-existe" }, registro)).toEqual({
        permitido: false,
        motivo: "modulo-desconhecido"
      });
  });

  it("no registro de produção, o COMUM vê só o Lab (e Treinamentos, transitório) e ninguém vê QLP", () => {
    // Treinamentos sai do COMUM quando os cenários entrarem no Lab (Fase 6): então esta lista encolhe.
    const visiveisAoComum = [
      "lab",
      "treinamentos",
      "colaboradores",
      "escalas",
      "qlp",
      "recrutamento",
      "dashboard",
      "usuarios",
      "auditoria",
      "importacoes",
      "parametros"
    ].filter((id) => can(eu("COMUM"), "modulo:ver", { moduloId: id }));
    expect(visiveisAoComum).toEqual(["lab", "treinamentos"]);
    for (const ator of perfis) {
      expect(can(eu(ator), "modulo:ver", { moduloId: "qlp" })).toBe(false);
      expect(can(eu(ator), "modulo:ver", { moduloId: "recrutamento" })).toBe(false);
    }
  });
});

describe("assistente de IA", () => {
  it("a equipe é ilimitada e completa; o COMUM é restrito ao Lab e a si", () => {
    for (const perfil of ["DEV", "ADMIN", "RH"] as const)
      expect(politicaDoAssistente(perfil)).toEqual({
        ilimitado: true,
        escopo: "completo",
        podeConsultarDados: true
      });
    expect(politicaDoAssistente("COMUM")).toEqual({
      ilimitado: false,
      escopo: "lab-proprio",
      podeConsultarDados: false
    });
    for (const perfil of perfis) expect(can(eu(perfil), "assistente:usar", undefined)).toBe(true);
  });
});

describe("invariantes (varredura completa)", () => {
  it("ninguém altera o próprio perfil, nem se desativa ou se remove", () => {
    for (const ator of perfis)
      for (const atual of perfis)
        for (const novo of perfis)
          for (const devsAtivos of [1, 2, 5]) {
            const eId = eu(ator).id;
            expect(
              can(eu(ator), "usuario:alterar-perfil", {
                id: eId,
                perfil: atual,
                novoPerfil: novo,
                devsAtivos
              })
            ).toBe(false);
            expect(can(eu(ator), "usuario:desativar", { id: eId, perfil: atual, devsAtivos })).toBe(
              false
            );
            expect(can(eu(ator), "usuario:remover", { id: eId, perfil: atual, devsAtivos })).toBe(
              false
            );
          }
  });

  it("o ADMIN nunca cria, edita, concede nem retira ADMIN ou DEV", () => {
    const alto: P[] = ["ADMIN", "DEV"];
    for (const alvo of alto) {
      expect(can(eu("ADMIN"), "usuario:criar", { perfil: alvo })).toBe(false);
      expect(can(eu("ADMIN"), "usuario:editar", { id: outro, perfil: alvo })).toBe(false);
      expect(
        can(eu("ADMIN"), "usuario:desativar", { id: outro, perfil: alvo, devsAtivos: 3 })
      ).toBe(false);
      expect(can(eu("ADMIN"), "usuario:remover", { id: outro, perfil: alvo, devsAtivos: 3 })).toBe(
        false
      );
    }
    for (const atual of perfis)
      for (const novo of perfis)
        if (alto.includes(atual) || alto.includes(novo))
          expect(
            can(eu("ADMIN"), "usuario:alterar-perfil", {
              id: outro,
              perfil: atual,
              novoPerfil: novo,
              devsAtivos: 3
            })
          ).toBe(false);
  });

  it("o RH só mexe em COMUM, e o COMUM não gerencia ninguém", () => {
    for (const alvo of perfis) {
      expect(can(eu("RH"), "usuario:criar", { perfil: alvo })).toBe(alvo === "COMUM");
      expect(can(eu("COMUM"), "usuario:criar", { perfil: alvo })).toBe(false);
    }
  });

  it("o último DEV ativo não é rebaixado, desativado nem removido (com 'ultimo-dev', 409)", () => {
    for (const novo of ["ADMIN", "RH", "COMUM"] as const)
      expect(
        decidirAcesso(eu("DEV"), "usuario:alterar-perfil", {
          id: outro,
          perfil: "DEV",
          novoPerfil: novo,
          devsAtivos: 1
        })
      ).toEqual({
        permitido: false,
        motivo: "ultimo-dev"
      });
    for (const acao of ["usuario:desativar", "usuario:remover"] as const) {
      expect(decidirAcesso(eu("DEV"), acao, { id: outro, perfil: "DEV", devsAtivos: 1 })).toEqual({
        permitido: false,
        motivo: "ultimo-dev"
      });
      expect(can(eu("DEV"), acao, { id: outro, perfil: "DEV", devsAtivos: 2 })).toBe(true);
    }
    expect(statusHttpDaNegacao("ultimo-dev")).toBe(409);
  });

  it("DEV pode conceder e retirar qualquer perfil, inclusive de outro DEV (havendo mais de um)", () => {
    for (const atual of perfis)
      for (const novo of perfis)
        expect(
          can(eu("DEV"), "usuario:alterar-perfil", {
            id: outro,
            perfil: atual,
            novoPerfil: novo,
            devsAtivos: 2
          })
        ).toBe(true);
  });

  it("COMUM nunca vê resultado de outra pessoa, de COMUM ou interno", () => {
    for (const donoPerfil of perfis)
      expect(
        can(eu("COMUM"), "lab:ver-resultado", {
          donoId: outro,
          donoPerfil,
          origem: donoPerfil === "COMUM" ? "participante" : "interno"
        })
      ).toBe(false);
  });

  it("todo motivo de negação tem um código HTTP, e só 'alheio' e módulo oculto/desconhecido viram 404", () => {
    const motivos: MotivoDaNegacao[] = [
      "perfil",
      "proprio",
      "alheio",
      "ultimo-dev",
      "modulo-oculto",
      "modulo-desconhecido",
      "alvo-invalido"
    ];
    const status = Object.fromEntries(motivos.map((m) => [m, statusHttpDaNegacao(m)]));
    expect(status).toEqual({
      perfil: 403,
      proprio: 403,
      alheio: 404,
      "ultimo-dev": 409,
      "modulo-oculto": 404,
      "modulo-desconhecido": 404,
      "alvo-invalido": 400
    });
  });

  it("toda ação conhecida responde para todos os perfis, sem lançar erro", () => {
    const alvos: Record<string, unknown> = {
      "modulo:ver": { moduloId: "lab" },
      "modulo:escrever": { moduloId: "lab" },
      "usuario:criar": { perfil: "COMUM" },
      "usuario:editar": { id: outro, perfil: "COMUM" },
      "usuario:alterar-perfil": { id: outro, perfil: "COMUM", novoPerfil: "COMUM", devsAtivos: 2 },
      "usuario:desativar": { id: outro, perfil: "COMUM", devsAtivos: 2 },
      "usuario:remover": { id: outro, perfil: "COMUM", devsAtivos: 2 },
      "lab:ver-resultado": { donoId: outro, donoPerfil: "COMUM", origem: "participante" },
      "lab:validar-resultado": { donoId: outro, donoPerfil: "COMUM", origem: "participante" },
      "lab:contestar": { donoId: outro, donoPerfil: "COMUM", origem: "participante" },
      "lab:decidir-contestacao": { donoId: outro, donoPerfil: "COMUM", origem: "participante" }
    };
    for (const acao of acoesDeAcesso)
      for (const ator of perfis) {
        const d = decidirAcesso(eu(ator), acao, alvos[acao] as never);
        expect(typeof d.permitido, `${acao} ${ator}`).toBe("boolean");
        if (!d.permitido) expect(statusHttpDaNegacao(d.motivo)).toBeGreaterThanOrEqual(400);
      }
  });
});
