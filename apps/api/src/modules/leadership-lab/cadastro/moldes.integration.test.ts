// Configuração dos moldes, de ponta a ponta: aplicativo real, JWT real, PostgreSQL real.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado. Veja db/test-database.ts.
import { labConfigDosMoldesSchema, labCodigosDeErroDoCadastro } from "@my-flux/shared";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { criarParticipante, criarSessao, inserir } from "../db/test-fixtures.js";
import { AmbienteDoCadastro, type Pessoa } from "./ambiente-do-cadastro.js";

const INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!integrationEnabled)("configuração dos moldes", () => {
  let amb: AmbienteDoCadastro;
  let admin: Pessoa;
  let dev: Pessoa;
  let rh: Pessoa;

  beforeAll(async () => {
    amb = await AmbienteDoCadastro.subir();
    admin = await amb.pessoa("ADMIN");
    dev = await amb.pessoa("DEV");
    rh = await amb.rhGlobal();
  }, 60_000);

  afterAll(async () => {
    await amb?.encerrar();
  });

  // Cada teste parte dos moldes como a migração os deixa: desligados, sem tempo e sem cargos, e sem
  // nenhum teste em andamento (um deixado por um teste anterior travaria a troca do tempo).
  beforeEach(async () => {
    await amb.consulta(
      `UPDATE leadership_lab.sessao SET status = 'cancelada' WHERE status = 'em_andamento'`
    );
    await amb.consulta(`DELETE FROM leadership_lab.molde_cargo`);
    await amb.consulta(
      `UPDATE leadership_lab.molde SET ativo = false, tempo_limite_s = NULL, atualizado_por = NULL`
    );
  });

  async function cargo(nome: string, status = "ACTIVE"): Promise<string> {
    return inserir(amb.banco.db.client, '"JobFunction"', {
      id: crypto.randomUUID(),
      name: nome,
      status,
      updatedAt: new Date().toISOString()
    });
  }

  const lerConfig = async (quem: Pessoa = admin) => {
    const r = await amb.http(quem, "GET", "/config/moldes");
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    return labConfigDosMoldesSchema.parse(r.corpo.data);
  };
  const molde = async (nivel: string) => (await lerConfig()).moldes.find((m) => m.nivel === nivel)!;
  const aplicar = (nivel: string, corpo: unknown, quem: Pessoa = admin) =>
    amb.http(quem, "PUT", `/config/moldes/${nivel}`, corpo);
  /** Para os passos de preparação: se falharem, o teste para aqui e não adiante. */
  const preparar = async (nivel: string, corpo: unknown) => {
    const r = await aplicar(nivel, corpo);
    expect(r.status, `preparação: ${JSON.stringify(r.corpo)}`).toBe(200);
  };

  describe("quem pode", () => {
    it("sem login é 401", async () => {
      expect((await amb.http(null, "GET", "/config/moldes")).status).toBe(401);
      expect(
        (
          await amb.http(null, "PUT", "/config/moldes/supervisor", {
            tempoLimiteS: null,
            ativo: false,
            cargoIds: []
          })
        ).status
      ).toBe(401);
    });

    it.each(["ADMIN", "DEV"] as const)("o perfil %s lê e altera", async (papel) => {
      const pessoa = papel === "ADMIN" ? admin : dev;
      expect((await amb.http(pessoa, "GET", "/config/moldes")).status).toBe(200);
      const r = await aplicar(
        "supervisor",
        { tempoLimiteS: 45, ativo: true, cargoIds: [] },
        pessoa
      );
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    });

    it.each(["RH", "COMUM"] as const)("o perfil %s não configura moldes", async (papel) => {
      const pessoa = papel === "RH" ? rh : await amb.usuarioComum();
      for (const r of [
        await amb.http(pessoa, "GET", "/config/moldes"),
        await aplicar("supervisor", { tempoLimiteS: 45, ativo: true, cargoIds: [] }, pessoa)
      ]) {
        expect(r.status).toBe(403);
        expect(r.corpo.code).toBe("LAB_FORBIDDEN");
      }
      expect((await molde("supervisor")).tempoLimiteS).toBeNull();
    });
  });

  describe("ler", () => {
    it("traz os três moldes na ordem dos níveis, desligados e sem tempo, como a migração os deixa", async () => {
      const config = await lerConfig();
      expect(config.moldes.map((m) => m.nivel)).toEqual([
        "encarregado",
        "supervisor",
        "coordenador"
      ]);
      for (const m of config.moldes) {
        expect(m).toMatchObject({
          ativo: false,
          tempoLimiteS: null,
          cargoIds: [],
          testesEmAndamento: 0
        });
        expect(m.temas.length).toBeGreaterThan(0);
        expect(m.numeroSituacoes).toBeGreaterThanOrEqual(3);
      }
    });

    it("lista só cargos ativos, com o molde a que pertencem", async () => {
      const ativo = await cargo("Cargo ativo livre");
      const arquivado = await cargo("Cargo arquivado", "ARCHIVED");
      const doSupervisor = await cargo("Cargo do supervisor");
      await preparar("supervisor", { tempoLimiteS: null, ativo: false, cargoIds: [doSupervisor] });

      const { cargos } = await lerConfig();
      const porId = new Map(cargos.map((c) => [c.id, c]));
      expect(porId.get(ativo)).toMatchObject({ nome: "Cargo ativo livre", moldeNivel: null });
      expect(porId.get(doSupervisor)).toMatchObject({ moldeNivel: "supervisor" });
      expect(porId.has(arquivado)).toBe(false);
      const nomes = cargos.map((c) => c.nome);
      expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
    });

    it("conta os testes em andamento de cada molde, e só os em andamento", async () => {
      const ctx = await criarParticipante(amb.banco.db.client, amb.banco.base);
      const sessao = await criarSessao(amb.banco.db.client, ctx);
      expect((await molde("supervisor")).testesEmAndamento).toBe(1);
      expect((await molde("coordenador")).testesEmAndamento).toBe(0);
      await amb.consulta(`UPDATE leadership_lab.sessao SET status = 'cancelada' WHERE id = $1`, [
        sessao
      ]);
      expect((await molde("supervisor")).testesEmAndamento).toBe(0);
    });
  });

  describe("atualizar", () => {
    it("define tempo, libera e liga os cargos; registra quem mudou, o antes e o depois", async () => {
      const a = await cargo("Cargo A");
      const b = await cargo("Cargo B");
      const moldeId = (await molde("supervisor")).id;
      const registrosAntes = (await amb.auditoria("LabMolde", moldeId)).length;
      const r = await aplicar("supervisor", { tempoLimiteS: 45, ativo: true, cargoIds: [a, b] });
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);

      const resposta = labConfigDosMoldesSchema.parse(r.corpo.data);
      const supervisor = resposta.moldes.find((m) => m.nivel === "supervisor")!;
      expect(supervisor).toMatchObject({ tempoLimiteS: 45, ativo: true });
      expect([...supervisor.cargoIds].sort()).toEqual([a, b].sort());
      expect(
        resposta.cargos
          .filter((c) => c.moldeNivel === "supervisor")
          .map((c) => c.id)
          .sort()
      ).toEqual([a, b].sort());

      const [linha] = await amb.consulta(
        `SELECT tempo_limite_s, ativo, atualizado_por FROM leadership_lab.molde WHERE nivel = 'supervisor'`
      );
      expect(linha).toEqual({ tempo_limite_s: 45, ativo: true, atualizado_por: admin.id });
      const ligados = await amb.consulta(
        `SELECT job_function_id, criado_por FROM leadership_lab.molde_cargo WHERE molde_id = $1`,
        [supervisor.id]
      );
      expect(ligados.map((l) => l.job_function_id).sort()).toEqual([a, b].sort());
      expect(ligados.every((l) => l.criado_por === admin.id)).toBe(true);

      const trilha = await amb.auditoria("LabMolde", supervisor.id);
      expect(trilha).toHaveLength(registrosAntes + 1);
      expect(trilha.at(-1)).toMatchObject({
        action: "UPDATE",
        userId: admin.id,
        userRole: "ADMIN",
        before: { nivel: "supervisor", tempoLimiteS: null, ativo: false, cargoIds: [] },
        after: { nivel: "supervisor", tempoLimiteS: 45, ativo: true, cargoIds: [a, b].sort() }
      });
    });

    it("é o estado desejado, inteiro: quem não está na lista sai do molde", async () => {
      const a = await cargo("Fica");
      const b = await cargo("Sai");
      await preparar("supervisor", { tempoLimiteS: 30, ativo: true, cargoIds: [a, b] });
      const r = await aplicar("supervisor", { tempoLimiteS: 30, ativo: true, cargoIds: [a] });
      expect((await molde("supervisor")).cargoIds).toEqual([a]);
      expect(r.corpo.data.cargos.find((c: { id: string }) => c.id === b).moldeNivel).toBeNull();
      // Lista vazia solta todos.
      await preparar("supervisor", { tempoLimiteS: 30, ativo: true, cargoIds: [] });
      expect((await molde("supervisor")).cargoIds).toEqual([]);
    });

    it("repetir o mesmo cargo na lista conta uma vez", async () => {
      const a = await cargo("Repetido");
      const r = await aplicar("supervisor", {
        tempoLimiteS: null,
        ativo: false,
        cargoIds: [a, a, a]
      });
      expect(r.status).toBe(200);
      expect((await molde("supervisor")).cargoIds).toEqual([a]);
    });

    it("desligar mantém o tempo e os cargos, e nenhum outro molde é tocado", async () => {
      const a = await cargo("Mantido");
      await preparar("supervisor", { tempoLimiteS: 50, ativo: true, cargoIds: [a] });
      await preparar("supervisor", { tempoLimiteS: 50, ativo: false, cargoIds: [a] });
      expect(await molde("supervisor")).toMatchObject({
        ativo: false,
        tempoLimiteS: 50,
        cargoIds: [a]
      });
      expect(await molde("encarregado")).toMatchObject({
        ativo: false,
        tempoLimiteS: null,
        cargoIds: []
      });
      expect(await molde("coordenador")).toMatchObject({
        ativo: false,
        tempoLimiteS: null,
        cargoIds: []
      });
    });

    it("liberar sem tempo é recusado com mensagem clara, e nada muda", async () => {
      const a = await cargo("Sem tempo");
      const r = await aplicar("supervisor", { tempoLimiteS: null, ativo: true, cargoIds: [a] });
      expect(r.status).toBe(422);
      expect(r.corpo.code).toBe("LAB_MOLDE_SEM_TEMPO");
      expect(await molde("supervisor")).toMatchObject({ ativo: false, cargoIds: [] });
    });

    it.each([
      ["zero", { tempoLimiteS: 0 }],
      ["negativo", { tempoLimiteS: -5 }],
      ["fracionado", { tempoLimiteS: 1.5 }],
      ["acima da faixa", { tempoLimiteS: 3601 }],
      ["texto", { tempoLimiteS: "45" }],
      ["sem o campo", { tempoLimiteS: undefined }]
    ])("tempo %s é recusado", async (_nome, parte) => {
      const r = await aplicar("supervisor", { ativo: false, cargoIds: [], ...parte });
      expect(r.status).toBe(400);
      expect(r.corpo.code).toBe("VALIDATION_ERROR");
    });

    it("recusa campo a mais, falta de campo e cargo que não é UUID", async () => {
      for (const corpo of [
        { tempoLimiteS: 30, ativo: true },
        { tempoLimiteS: 30, cargoIds: [] },
        { tempoLimiteS: 30, ativo: true, cargoIds: ["x"] },
        { tempoLimiteS: 30, ativo: true, cargoIds: [], temas: ["outro"] },
        { tempoLimiteS: 30, ativo: true, cargoIds: [], numeroSituacoes: 9 },
        { tempoLimiteS: 30, ativo: "sim", cargoIds: [] }
      ]) {
        expect((await aplicar("supervisor", corpo)).status, JSON.stringify(corpo)).toBe(400);
      }
    });

    it("nível que não existe é 'não encontrado'", async () => {
      const r = await aplicar("diretor", { tempoLimiteS: 30, ativo: true, cargoIds: [] });
      expect(r.status).toBe(404);
      expect(r.corpo.code).toBe("LAB_NOT_FOUND");
    });
  });

  describe("cargos", () => {
    it("cargo que já é de outro molde é recusado, com o nome dele, e nada muda", async () => {
      const compartilhado = await cargo("Cargo disputado");
      const livre = await cargo("Cargo livre");
      await preparar("supervisor", { tempoLimiteS: null, ativo: false, cargoIds: [compartilhado] });

      const r = await aplicar("coordenador", {
        tempoLimiteS: null,
        ativo: false,
        cargoIds: [livre, compartilhado]
      });
      expect(r.status).toBe(409);
      expect(r.corpo.code).toBe("LAB_CARGO_EM_OUTRO_MOLDE");
      expect(r.corpo.details.cargos).toEqual(["Cargo disputado"]);
      expect(r.corpo.message).toContain("Cargo disputado");
      // Atômico: o cargo livre também não entrou, e o disputado continua no supervisor.
      expect((await molde("coordenador")).cargoIds).toEqual([]);
      expect((await molde("supervisor")).cargoIds).toEqual([compartilhado]);
    });

    it("cargo que não existe, ou está arquivado, é recusado", async () => {
      const arquivado = await cargo("Arquivado", "ARCHIVED");
      for (const cargoIds of [[INEXISTENTE], [arquivado]]) {
        const r = await aplicar("supervisor", { tempoLimiteS: null, ativo: false, cargoIds });
        expect(r.status).toBe(422);
        expect(r.corpo.code).toBe("LAB_CARGO_INEXISTENTE");
      }
    });

    it("um molde pode ser reaplicado com os próprios cargos sem conflito consigo mesmo", async () => {
      const a = await cargo("Reaplicado");
      await preparar("supervisor", { tempoLimiteS: 30, ativo: true, cargoIds: [a] });
      expect(
        (await aplicar("supervisor", { tempoLimiteS: 30, ativo: true, cargoIds: [a] })).status
      ).toBe(200);
    });

    it("para trocar um cargo de molde, primeiro tira dele e depois põe no outro", async () => {
      const a = await cargo("Mudou de molde");
      await preparar("supervisor", { tempoLimiteS: null, ativo: false, cargoIds: [a] });
      await preparar("supervisor", { tempoLimiteS: null, ativo: false, cargoIds: [] });
      expect(
        (await aplicar("coordenador", { tempoLimiteS: null, ativo: false, cargoIds: [a] })).status
      ).toBe(200);
      expect((await molde("coordenador")).cargoIds).toEqual([a]);
    });
  });

  describe("testes em andamento", () => {
    it("com teste em andamento, o tempo não muda; liberação e cargos podem", async () => {
      await preparar("supervisor", { tempoLimiteS: 60, ativo: true, cargoIds: [] });
      const ctx = await criarParticipante(amb.banco.db.client, amb.banco.base);
      await criarSessao(amb.banco.db.client, ctx);

      const recusa = await aplicar("supervisor", { tempoLimiteS: 30, ativo: true, cargoIds: [] });
      expect(recusa.status).toBe(409);
      expect(recusa.corpo.code).toBe("LAB_MOLDE_COM_TESTES_EM_ANDAMENTO");
      expect(recusa.corpo.details).toEqual({ testes: 1 });
      expect((await molde("supervisor")).tempoLimiteS).toBe(60);

      // Mesmo tempo: o resto pode mudar (o teste em curso termina com o tempo que tinha).
      const a = await cargo("Durante o teste");
      const ok = await aplicar("supervisor", { tempoLimiteS: 60, ativo: false, cargoIds: [a] });
      expect(ok.status, JSON.stringify(ok.corpo)).toBe(200);
      expect(await molde("supervisor")).toMatchObject({
        tempoLimiteS: 60,
        ativo: false,
        cargoIds: [a]
      });
    });

    it("sem teste em andamento o tempo muda; teste concluído ou cancelado não segura", async () => {
      await preparar("supervisor", { tempoLimiteS: 60, ativo: true, cargoIds: [] });
      const ctx = await criarParticipante(amb.banco.db.client, amb.banco.base);
      await criarSessao(amb.banco.db.client, ctx, { status: "cancelada" });
      expect(
        (await aplicar("supervisor", { tempoLimiteS: 20, ativo: true, cargoIds: [] })).status
      ).toBe(200);
    });

    it("um teste que começa no meio da troca não escapa: a troca espera e depois vê o teste", async () => {
      await preparar("supervisor", { tempoLimiteS: 60, ativo: true, cargoIds: [] });
      const ctx = await criarParticipante(amb.banco.db.client, amb.banco.base);

      // Outra conexão abre o teste e deixa a transação aberta: ela segura a linha do molde (a
      // chave estrangeira da sessão), exatamente como o motor faz ao iniciar um teste.
      const outra = new pg.Client({ connectionString: amb.banco.db.url });
      await outra.connect();
      try {
        await outra.query("BEGIN");
        await outra.query(
          `INSERT INTO leadership_lab.sessao (participante_id, molde_id) VALUES ($1, $2)`,
          [ctx.participanteId, amb.banco.base.moldeId]
        );

        let respondeu = false;
        const troca = aplicar("supervisor", { tempoLimiteS: 30, ativo: true, cargoIds: [] }).then(
          (r) => {
            respondeu = true;
            return r;
          }
        );
        await new Promise((r) => setTimeout(r, 500));
        // Sem a trava da linha, a troca já teria passado: o teste ainda não era visível.
        expect(respondeu).toBe(false);

        await outra.query("COMMIT");
        const r = await troca;
        expect(r.status).toBe(409);
        expect(r.corpo.code).toBe("LAB_MOLDE_COM_TESTES_EM_ANDAMENTO");
        expect((await molde("supervisor")).tempoLimiteS).toBe(60);
      } finally {
        await outra.end();
      }
    });
  });

  describe("de ponta a ponta: o que antes era SQL agora é tela", () => {
    it("o RH liga o participante, o administrador libera o molde e o participante consegue iniciar", async () => {
      const funcao = await cargo("Supervisor de campo");
      const usuario = await amb.usuarioComum();
      const employeeId = await amb.colaborador({ functionId: funcao });
      const ligado = await amb.http(rh, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(ligado.status, JSON.stringify(ligado.corpo)).toBe(200);

      await amb.http(usuario, "POST", "/termo");
      const acao = async () => (await amb.http(usuario, "GET", "/painel")).corpo.data.acao;
      // O cargo ainda não está em molde algum.
      expect(await acao()).toMatchObject({ tipo: "indisponivel", motivo: "molde-nao-mapeado" });

      // Ligado ao molde, mas o molde ainda está desligado.
      await preparar("supervisor", { tempoLimiteS: null, ativo: false, cargoIds: [funcao] });
      expect(await acao()).toMatchObject({ tipo: "indisponivel", motivo: "molde-inativo" });

      // Liberado: o participante pode iniciar.
      await preparar("supervisor", { tempoLimiteS: 90, ativo: true, cargoIds: [funcao] });
      expect(await acao()).toMatchObject({ tipo: "iniciar", molde: { nivel: "supervisor" } });
      const inicio = await amb.http(usuario, "POST", "/sessoes");
      expect(inicio.status, JSON.stringify(inicio.corpo)).toBe(200);
      expect(inicio.corpo.data.situacao.tempoLimiteS).toBe(90);
    });
  });

  it("os códigos de erro do cadastro são os do contrato", () => {
    expect(new Set(labCodigosDeErroDoCadastro).size).toBe(labCodigosDeErroDoCadastro.length);
  });
});
