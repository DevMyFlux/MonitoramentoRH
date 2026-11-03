import { describe, expect, it } from "vitest";
import { roleRank } from "./index.js";
import type { LabPermissao } from "./leadership-lab.js";
import {
  avaliarAcesso,
  labAcoes,
  labMatrizAcesso,
  papeisLab,
  podeExecutar,
  type LabAcao,
  type LabAtor,
  type PapelLab
} from "./leadership-lab-acesso.js";

function ator(role: LabAtor["role"], extra: Partial<LabAtor> = {}): LabAtor {
  return {
    userId: `user-${role}`,
    role,
    participanteId: role === "COMUM" ? "participante-1" : null,
    permissoes: [],
    ...extra
  };
}

const gestao: LabPermissao[] = ["lab_gestao"];
const especialista: LabPermissao[] = ["lab_especialista"];

/** Os atores do cenário. Os nomes são usados na tabela de resultados esperados. */
const atores = {
  comum: ator("COMUM"),
  comumSemVinculo: ator("COMUM", { participanteId: null }),
  comumGestao: ator("COMUM", { permissoes: gestao }),
  comumEspecialista: ator("COMUM", { permissoes: especialista }),
  rh: ator("RH"),
  rhGestao: ator("RH", { permissoes: gestao }),
  admin: ator("ADMIN"),
  adminGestao: ator("ADMIN", { permissoes: gestao }),
  dev: ator("DEV")
} as const;
type NomeDoAtor = keyof typeof atores;

const participantes: NomeDoAtor[] = ["comum", "comumGestao", "comumEspecialista"];
const curadores: NomeDoAtor[] = ["rh", "rhGestao"];
const administradores: NomeDoAtor[] = ["admin", "adminGestao", "dev"];
const gestores: NomeDoAtor[] = ["comumGestao", "rhGestao", "adminGestao"];

/**
 * Tabela de verdade escrita a partir da documentação (seções "Usuários e permissões" e
 * "API do módulo"), à parte da implementação. Para cada ação, quem PODE; todo o resto deve
 * ser negado. Ação nova sem linha aqui reprova o teste.
 *
 * Aqui as ações são pedidas SEM alvo (listar, criar ou o próprio usuário). O escopo sobre
 * recursos específicos é testado mais abaixo.
 */
const podem: Record<LabAcao, NomeDoAtor[]> = {
  "painel:ler": participantes,
  "termo:aceitar": participantes,
  "moldes:listar": participantes,
  "sessao:iniciar": participantes,
  "sessao:responder": participantes,
  "sessao:tempo-esgotado": participantes,
  "contestacao:criar": participantes,
  "resultado:ler": [...participantes, ...curadores],
  "revisao:listar": curadores,
  "resultado:validar": curadores,
  "alerta:listar": curadores,
  "alerta:tratar": curadores,
  "contribuicao:listar": curadores,
  "contribuicao:decidir": curadores,
  "contestacao:listar": curadores,
  "contestacao:decidir": curadores,
  "turma:listar": curadores,
  "turma:criar": curadores,
  "agregados:ler": gestores,
  "config-moldes:ler": administradores,
  "config-moldes:atualizar": administradores
};

describe("matriz de permissões do Leadership Lab", () => {
  it("a tabela de verdade cobre exatamente as ações da matriz", () => {
    expect(Object.keys(podem).sort()).toEqual([...labAcoes].sort());
  });

  describe.each(labAcoes)("%s", (acao) => {
    it.each(Object.keys(atores) as NomeDoAtor[])("%s", (nome) => {
      const esperado = podem[acao].includes(nome);
      expect(podeExecutar(atores[nome], acao)).toBe(esperado);
    });
  });

  it("os perfis da matriz são exatamente os do sistema de RH", () => {
    // Igualdade de tipos, verificada pelo `pnpm typecheck`: se roleRank ganhar ou perder
    // um perfil, esta linha deixa de compilar.
    type Perfis = keyof typeof roleRank;
    const iguais: [Perfis] extends [LabAtor["role"]]
      ? [LabAtor["role"]] extends [Perfis]
        ? true
        : never
      : never = true;
    expect(iguais).toBe(true);
    expect(Object.keys(roleRank).sort()).toEqual(["ADMIN", "COMUM", "DEV", "RH"]);
  });
});

describe("papéis", () => {
  it("cada perfil e cada permissão dão o seu papel, e só ele", () => {
    const papeis = (a: LabAtor) => [...papeisLab(a)].sort();
    expect(papeis(atores.comum)).toEqual(["participante"]);
    expect(papeis(atores.rh)).toEqual(["curador"]);
    expect(papeis(atores.admin)).toEqual(["administrador"]);
    expect(papeis(atores.dev)).toEqual(["administrador"]);
    expect(papeis(atores.comumGestao)).toEqual(["gestao", "participante"]);
    expect(papeis(atores.rhGestao)).toEqual(["curador", "gestao"]);
    expect(papeis(atores.comumEspecialista)).toEqual(["especialista", "participante"]);
  });

  it("não há herança de hierarquia: ADMIN e DEV não são curadores nem participantes", () => {
    for (const nome of ["admin", "dev"] as const) {
      const papeis = papeisLab(atores[nome]);
      expect(papeis.has("curador")).toBe(false);
      expect(papeis.has("participante")).toBe(false);
    }
    expect(papeisLab(atores.rh).has("participante")).toBe(false);
  });
});

describe("estrutura da matriz (vale para qualquer ação que se acrescente)", () => {
  const celulas = labAcoes.flatMap((acao) =>
    (Object.entries(labMatrizAcesso[acao]) as Array<[PapelLab, string]>).map(([papel, escopo]) => ({
      acao,
      papel,
      escopo
    }))
  );

  it("toda ação tem ao menos um papel", () => {
    for (const acao of labAcoes) {
      expect(Object.keys(labMatrizAcesso[acao]).length, acao).toBeGreaterThan(0);
    }
  });

  it("participante alcança só dados próprios; curador, só os da turma", () => {
    for (const c of celulas.filter((x) => x.papel === "participante")) {
      expect(c.escopo, c.acao).toBe("proprios");
    }
    for (const c of celulas.filter((x) => x.papel === "curador")) {
      expect(c.escopo, c.acao).toBe("turma");
    }
  });

  it("gestão só alcança agregados; administrador, só configuração", () => {
    for (const c of celulas.filter((x) => x.papel === "gestao")) {
      expect(c.escopo, c.acao).toBe("agregados");
    }
    for (const c of celulas.filter((x) => x.papel === "administrador")) {
      expect(c.escopo, c.acao).toBe("configuracao");
    }
  });

  it("nenhum dado individual chega a gestão, administrador ou especialista", () => {
    const comDadoDePessoa = celulas.filter((c) => c.escopo === "proprios" || c.escopo === "turma");
    for (const c of comDadoDePessoa) {
      expect(["participante", "curador"], `${c.acao} -> ${c.papel}`).toContain(c.papel);
    }
  });

  it("o especialista (versão 1) ainda não tem nenhuma ação no piloto", () => {
    expect(celulas.filter((c) => c.papel === "especialista")).toEqual([]);
  });
});

describe("escopo dos dados: o participante só alcança o que é seu", () => {
  const acoesDoParticipante = labAcoes.filter((a) => "participante" in labMatrizAcesso[a]);

  it.each(acoesDoParticipante)("%s: recurso de outro participante -> alheio", (acao) => {
    expect(avaliarAcesso(atores.comum, acao, { participanteId: "participante-2" })).toEqual({
      permitido: false,
      motivo: "alheio"
    });
  });

  it.each(acoesDoParticipante)("%s: recurso próprio -> permitido", (acao) => {
    expect(avaliarAcesso(atores.comum, acao, { participanteId: "participante-1" })).toEqual({
      permitido: true
    });
  });

  it("usuário COMUM sem vínculo com um colaborador não faz nada de participante", () => {
    for (const acao of acoesDoParticipante) {
      expect(avaliarAcesso(atores.comumSemVinculo, acao), acao).toEqual({
        permitido: false,
        motivo: "sem-vinculo"
      });
    }
  });

  it("um RH vinculado por engano a um colaborador continua sem poder fazer testes", () => {
    const rhVinculado = ator("RH", { participanteId: "participante-1" });
    expect(avaliarAcesso(rhVinculado, "sessao:iniciar")).toEqual({
      permitido: false,
      motivo: "perfil"
    });
    expect(avaliarAcesso(rhVinculado, "painel:ler")).toEqual({
      permitido: false,
      motivo: "perfil"
    });
  });

  it("ADMIN e DEV não fazem testes mesmo vinculados", () => {
    for (const role of ["ADMIN", "DEV"] as const) {
      const vinculado = ator(role, { participanteId: "participante-1" });
      expect(podeExecutar(vinculado, "sessao:iniciar")).toBe(false);
    }
  });
});

describe("escopo dos dados: o curador só alcança as turmas que acompanha", () => {
  const turma = new Set(["participante-1", "participante-3"]);
  const acoesDoCurador = labAcoes.filter((a) => "curador" in labMatrizAcesso[a]);

  it.each(acoesDoCurador)("%s: participante da turma -> permitido", (acao) => {
    expect(
      avaliarAcesso(atores.rh, acao, {
        participanteId: "participante-3",
        participantesDasTurmas: turma
      })
    ).toEqual({ permitido: true });
  });

  it.each(acoesDoCurador)("%s: participante de fora da turma -> fora-da-turma", (acao) => {
    expect(
      avaliarAcesso(atores.rh, acao, {
        participanteId: "participante-9",
        participantesDasTurmas: turma
      })
    ).toEqual({ permitido: false, motivo: "fora-da-turma" });
  });

  it.each(acoesDoCurador)(
    "%s: falha fechado sem o conjunto de turmas, ou com ele vazio",
    (acao) => {
      expect(avaliarAcesso(atores.rh, acao, { participanteId: "participante-1" })).toMatchObject({
        permitido: false,
        motivo: "fora-da-turma"
      });
      expect(
        avaliarAcesso(atores.rh, acao, {
          participanteId: "participante-1",
          participantesDasTurmas: new Set()
        })
      ).toMatchObject({ permitido: false, motivo: "fora-da-turma" });
    }
  );

  it("listar e criar, sem alvo, passam: quem filtra pelas turmas é a consulta", () => {
    expect(podeExecutar(atores.rh, "revisao:listar")).toBe(true);
    expect(podeExecutar(atores.rh, "turma:criar")).toBe(true);
  });

  it("ADMIN e DEV não leem dados de ninguém, nem dos que estão numa turma", () => {
    for (const nome of ["admin", "dev", "adminGestao"] as const) {
      for (const acao of ["resultado:ler", "resultado:validar", "alerta:listar"] as const) {
        expect(
          avaliarAcesso(atores[nome], acao, {
            participanteId: "participante-1",
            participantesDasTurmas: turma
          }),
          `${nome} ${acao}`
        ).toEqual({ permitido: false, motivo: "perfil" });
      }
    }
  });

  it("gestão não lê dado individual, nem como curador: o escopo vem do papel certo", () => {
    // RH com lab_gestao continua sendo curador só das turmas dele.
    expect(
      avaliarAcesso(atores.rhGestao, "resultado:ler", {
        participanteId: "participante-9",
        participantesDasTurmas: turma
      })
    ).toEqual({ permitido: false, motivo: "fora-da-turma" });
    // COMUM com lab_gestao lê agregados, mas não o resultado de outra pessoa.
    expect(podeExecutar(atores.comumGestao, "agregados:ler")).toBe(true);
    expect(
      avaliarAcesso(atores.comumGestao, "resultado:ler", { participanteId: "participante-2" })
    ).toEqual({
      permitido: false,
      motivo: "alheio"
    });
  });
});

describe("resultado:ler atende participante e curador", () => {
  it("o participante lê o próprio; o curador lê o da turma; ninguém lê o de fora", () => {
    const turma = new Set(["participante-5"]);
    expect(podeExecutar(atores.comum, "resultado:ler", { participanteId: "participante-1" })).toBe(
      true
    );
    expect(podeExecutar(atores.comum, "resultado:ler", { participanteId: "participante-5" })).toBe(
      false
    );
    expect(
      podeExecutar(atores.rh, "resultado:ler", {
        participanteId: "participante-5",
        participantesDasTurmas: turma
      })
    ).toBe(true);
    expect(
      podeExecutar(atores.rh, "resultado:ler", {
        participanteId: "participante-1",
        participantesDasTurmas: turma
      })
    ).toBe(false);
  });
});
