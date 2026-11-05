// Cadastro dos participantes, de ponta a ponta: aplicativo real, JWT real, PostgreSQL real.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado. Veja db/test-database.ts.
import {
  labColaboradorDoCadastroSchema,
  labParticipanteDoCadastroSchema,
  labUsuarioElegivelSchema
} from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { criarCargoComMolde } from "../db/test-fixtures.js";
import { AmbienteDoCadastro, type Operacao, type Pessoa } from "./ambiente-do-cadastro.js";

const INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!integrationEnabled)("cadastro dos participantes", () => {
  let amb: AmbienteDoCadastro;
  let opA: Operacao;
  let opB: Operacao;
  let rhGlobal: Pessoa;
  let rhA: Pessoa;
  let rhB: Pessoa;

  beforeAll(async () => {
    amb = await AmbienteDoCadastro.subir();
    opA = amb.operacaoA;
    opB = await amb.criarOperacao("Operação B");
    rhGlobal = await amb.rhGlobal();
    rhA = await amb.rhDaOperacao(opA);
    rhB = await amb.rhDaOperacao(opB);
  }, 60_000);

  afterAll(async () => {
    await amb?.encerrar();
  });

  /** Um colaborador e um usuário comum, prontos para serem ligados. */
  async function par(operacao?: Operacao, colaborador: Record<string, unknown> = {}) {
    return {
      employeeId: await amb.colaborador(colaborador, operacao),
      usuario: await amb.usuarioComum()
    };
  }

  describe("quem pode", () => {
    const rotas: Array<["GET" | "POST" | "PATCH", string, unknown?]> = [
      ["GET", "/participantes"],
      ["POST", "/participantes", { userId: INEXISTENTE, employeeId: INEXISTENTE }],
      ["PATCH", `/participantes/${INEXISTENTE}`, { ativo: false }],
      ["GET", "/colaboradores-elegiveis?busca=ab"],
      ["GET", "/usuarios-elegiveis?busca=ab"]
    ];

    it.each(rotas)("%s %s sem login é 401", async (metodo, caminho, corpo) => {
      expect((await amb.http(null, metodo, caminho, corpo)).status).toBe(401);
    });

    it.each(["COMUM", "ADMIN"] as const)(
      "o perfil %s não cadastra participantes",
      async (papel) => {
        const pessoa = await amb.pessoa(papel, [{ isGlobal: true }]);
        for (const [metodo, caminho, corpo] of rotas) {
          const r = await amb.http(pessoa, metodo, caminho, corpo);
          expect(r.status, `${metodo} ${caminho}`).toBe(403);
          expect(r.corpo.code).toBe("LAB_FORBIDDEN");
        }
      }
    );

    it("a gestão (lab_gestao) não ganha o cadastro por isso", async () => {
      const pessoa = await amb.pessoa("COMUM", [{ isGlobal: true }]);
      await amb.consulta(
        `INSERT INTO leadership_lab.permissao_usuario (user_id, permissao) VALUES ($1, 'lab_gestao')`,
        [pessoa.id]
      );
      expect((await amb.http(pessoa, "GET", "/participantes")).status).toBe(403);
    });
  });

  describe("cadastrar", () => {
    it("liga o usuário ao colaborador, devolve a visão do contrato e grava a auditoria", async () => {
      const funcao = await criarCargoComMolde(amb.banco.db.client, "supervisor");
      const { employeeId, usuario } = await par(undefined, {
        name: "Ana Souza",
        identifier: "MAT-ANA",
        functionId: funcao
      });

      const r = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      const visao = labParticipanteDoCadastroSchema.parse(r.corpo.data);
      expect(visao).toMatchObject({
        ativo: true,
        colaborador: {
          id: employeeId,
          nome: "Ana Souza",
          identificador: "MAT-ANA",
          operacao: "Operação",
          molde: { nivel: "supervisor", nome: "Supervisor", liberado: true }
        },
        usuario: { id: usuario.id }
      });

      const [linha] = await amb.consulta(
        `SELECT user_id, employee_id, ativo, criado_por FROM leadership_lab.participante WHERE id = $1`,
        [visao.id]
      );
      expect(linha).toEqual({
        user_id: usuario.id,
        employee_id: employeeId,
        ativo: true,
        criado_por: rhGlobal.id
      });

      const [auditoria, ...resto] = await amb.auditoria("LabParticipante", visao.id);
      expect(resto).toEqual([]);
      expect(auditoria).toMatchObject({
        action: "CREATE",
        userId: rhGlobal.id,
        userRole: "RH",
        operationId: opA.operationId,
        after: { participanteId: visao.id, userId: usuario.id, employeeId }
      });
    });

    it("a visão do molde diz quando o teste ainda não foi liberado", async () => {
      // O molde do coordenador está inativo no cenário.
      const funcao = await criarCargoComMolde(amb.banco.db.client, "coordenador");
      const { employeeId, usuario } = await par(undefined, { functionId: funcao });
      const r = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(r.corpo.data.colaborador.molde).toEqual({
        nivel: "coordenador",
        nome: "Coordenador",
        liberado: false
      });
    });

    it("colaborador sem cargo fica sem molde", async () => {
      const { employeeId, usuario } = await par();
      const r = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(r.corpo.data.colaborador).toMatchObject({ cargo: null, molde: null });
    });

    it("o colaborador fora do escopo responde 'não encontrado', igual ao que não existe", async () => {
      const { employeeId, usuario } = await par(opB);
      const fora = await amb.http(rhA, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      const nada = await amb.http(rhA, "POST", "/participantes", {
        userId: usuario.id,
        employeeId: INEXISTENTE
      });
      expect(fora.status).toBe(404);
      expect(fora.corpo).toEqual(nada.corpo);
      expect(fora.corpo.code).toBe("LAB_NOT_FOUND");
      expect(
        await amb.consulta(`SELECT 1 FROM leadership_lab.participante WHERE user_id = $1`, [
          usuario.id
        ])
      ).toEqual([]);
    });

    it("o RH sem nenhum escopo não cadastra ninguém", async () => {
      const semEscopo = await amb.pessoa("RH");
      const { employeeId, usuario } = await par();
      const r = await amb.http(semEscopo, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(r.status).toBe(404);
    });

    it("usuário que não é comum, está inativo ou não existe: a mesma recusa", async () => {
      const employeeId = await amb.colaborador();
      const candidatos = [
        await amb.pessoa("RH"),
        await amb.pessoa("ADMIN"),
        await amb.usuarioComum({ isActive: false }),
        await amb.usuarioComum({ status: "ARCHIVED" }),
        { id: INEXISTENTE, token: "" }
      ];
      const respostas = [];
      for (const c of candidatos) {
        respostas.push(
          await amb.http(rhGlobal, "POST", "/participantes", { userId: c.id, employeeId })
        );
      }
      for (const r of respostas) {
        expect(r.status).toBe(422);
        expect(r.corpo.code).toBe("LAB_USUARIO_NAO_ELEGIVEL");
      }
      // Não confirma nem desmente que a conta existe.
      expect(new Set(respostas.map((r) => r.corpo.message)).size).toBe(1);
    });

    it.each([
      ["desligado", { status: "TERMINATED" }],
      ["inativo", { status: "INACTIVE" }],
      ["com admissão agendada", { status: "SCHEDULED_ADMISSION" }],
      ["arquivado", { recordStatus: "ARCHIVED" }]
    ])("colaborador %s não vira participante", async (_nome, colunas) => {
      const { employeeId, usuario } = await par(undefined, colunas);
      const r = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(r.status).toBe(422);
      expect(r.corpo.code).toBe("LAB_COLABORADOR_NAO_ELEGIVEL");
    });

    it.each([
      ["de licença", "ON_LEAVE"],
      ["de férias", "VACATION"]
    ])("colaborador %s continua elegível", async (_nome, status) => {
      const { employeeId, usuario } = await par(undefined, { status });
      const r = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(r.status).toBe(200);
    });

    it("colaborador de operação inativa não vira participante", async () => {
      const inativa = await amb.criarOperacao("Operação parada", "INACTIVE");
      const { employeeId, usuario } = await par(inativa);
      const r = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: usuario.id,
        employeeId
      });
      expect(r.status).toBe(422);
      expect(r.corpo.code).toBe("LAB_COLABORADOR_NAO_ELEGIVEL");
    });

    it("não cadastra duas vezes o mesmo colaborador nem o mesmo usuário", async () => {
      const { employeeId, usuario } = await par();
      expect(
        (await amb.http(rhGlobal, "POST", "/participantes", { userId: usuario.id, employeeId }))
          .status
      ).toBe(200);

      const mesmoColaborador = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: (await amb.usuarioComum()).id,
        employeeId
      });
      const mesmoUsuario = await amb.http(rhGlobal, "POST", "/participantes", {
        userId: usuario.id,
        employeeId: await amb.colaborador()
      });
      for (const r of [mesmoColaborador, mesmoUsuario]) {
        expect(r.status).toBe(409);
        expect(r.corpo.code).toBe("LAB_PARTICIPANTE_JA_CADASTRADO");
      }
    });

    it("dois cadastros simultâneos do mesmo par: um vale, o outro é recusado", async () => {
      const { employeeId, usuario } = await par();
      const corpo = { userId: usuario.id, employeeId };
      const respostas = await Promise.all([
        amb.http(rhGlobal, "POST", "/participantes", corpo),
        amb.http(rhGlobal, "POST", "/participantes", corpo)
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
      const linhas = await amb.consulta(
        `SELECT 1 FROM leadership_lab.participante WHERE user_id = $1`,
        [usuario.id]
      );
      expect(linhas).toHaveLength(1);
    });

    it("recusa corpo com campo a mais, sem campo ou com id que não é UUID", async () => {
      const { employeeId, usuario } = await par();
      for (const corpo of [
        { userId: usuario.id, employeeId, ativo: false },
        { userId: usuario.id },
        { userId: "abc", employeeId },
        {}
      ]) {
        const r = await amb.http(rhGlobal, "POST", "/participantes", corpo);
        expect(r.status, JSON.stringify(corpo)).toBe(400);
        expect(r.corpo.code).toBe("VALIDATION_ERROR");
      }
    });

    it("um cadastro que dá errado não deixa auditoria para trás", async () => {
      const { employeeId, usuario } = await par();
      await amb.http(rhGlobal, "POST", "/participantes", { userId: usuario.id, employeeId });
      const antes = await amb.consulta(
        `SELECT count(*)::int AS n FROM "AuditLog" WHERE entity = 'LabParticipante'`
      );
      await amb.http(rhGlobal, "POST", "/participantes", { userId: usuario.id, employeeId });
      const depois = await amb.consulta(
        `SELECT count(*)::int AS n FROM "AuditLog" WHERE entity = 'LabParticipante'`
      );
      expect(depois).toEqual(antes);
    });
  });

  describe("listar e atualizar", () => {
    it("cada RH lista só os participantes das operações do seu escopo", async () => {
      const a = await par(opA, { name: "Lista A" });
      const b = await par(opB, { name: "Lista B" });
      const idA = await amb.vincular(a.usuario.id, a.employeeId);
      const idB = await amb.vincular(b.usuario.id, b.employeeId);

      const ids = async (quem: Pessoa) =>
        ((await amb.http(quem, "GET", "/participantes")).corpo.data as Array<{ id: string }>).map(
          (p) => p.id
        );
      expect(await ids(rhGlobal)).toEqual(expect.arrayContaining([idA, idB]));
      const doA = await ids(rhA);
      expect(doA).toContain(idA);
      expect(doA).not.toContain(idB);
      const doB = await ids(rhB);
      expect(doB).toContain(idB);
      expect(doB).not.toContain(idA);
      expect(await ids(await amb.pessoa("RH"))).toEqual([]);
    });

    it("a listagem entrega só o contrato: sem senha, sem resultado, sem dado a mais", async () => {
      const a = await par(opA);
      await amb.vincular(a.usuario.id, a.employeeId);
      const r = await amb.http(rhA, "GET", "/participantes");
      for (const p of r.corpo.data) {
        labParticipanteDoCadastroSchema.parse(p);
        expect(Object.keys(p).sort()).toEqual([
          "ativo",
          "colaborador",
          "id",
          "usuario",
          "vinculadoEm"
        ]);
        expect(Object.keys(p.usuario).sort()).toEqual(["email", "id", "nome"]);
        expect(Object.keys(p.colaborador).sort()).toEqual([
          "cargo",
          "id",
          "identificador",
          "molde",
          "nome",
          "operacao"
        ]);
      }
      expect(JSON.stringify(r.corpo)).not.toMatch(/passwordHash|senha/i);
    });

    it("desativa e reativa; o participante desativado perde o acesso e volta ao reativar", async () => {
      const a = await par(opA);
      const id = await amb.vincular(a.usuario.id, a.employeeId);

      const desativado = await amb.http(rhA, "PATCH", `/participantes/${id}`, { ativo: false });
      expect(desativado.status).toBe(200);
      expect(desativado.corpo.data.ativo).toBe(false);
      // Sem acesso: o vínculo desativado vale como ausência de vínculo.
      const painel = await amb.http(a.usuario, "GET", "/painel");
      expect(painel.status).toBe(403);
      expect(painel.corpo.code).toBe("LAB_SEM_VINCULO");

      const reativado = await amb.http(rhA, "PATCH", `/participantes/${id}`, { ativo: true });
      expect(reativado.corpo.data.ativo).toBe(true);
      expect((await amb.http(a.usuario, "GET", "/painel")).status).toBe(200);

      const trilha = await amb.auditoria("LabParticipante", id);
      expect(trilha.map((t) => [t.action, t.before, t.after])).toEqual([
        ["UPDATE", { ativo: true }, { ativo: false }],
        ["UPDATE", { ativo: false }, { ativo: true }]
      ]);
    });

    it("pedir o valor que já está não muda nada nem grava auditoria", async () => {
      const a = await par(opA);
      const id = await amb.vincular(a.usuario.id, a.employeeId);
      const r = await amb.http(rhA, "PATCH", `/participantes/${id}`, { ativo: true });
      expect(r.status).toBe(200);
      expect(await amb.auditoria("LabParticipante", id)).toEqual([]);
    });

    it("participante de fora do escopo, inexistente ou com id torto: o mesmo 'não encontrado'", async () => {
      const b = await par(opB);
      const id = await amb.vincular(b.usuario.id, b.employeeId);
      const respostas = [
        await amb.http(rhA, "PATCH", `/participantes/${id}`, { ativo: false }),
        await amb.http(rhA, "PATCH", `/participantes/${INEXISTENTE}`, { ativo: false }),
        await amb.http(rhA, "PATCH", `/participantes/nao-e-uuid`, { ativo: false })
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(r.corpo).toEqual(respostas[0]!.corpo);
      }
      const [{ ativo }] = await amb.consulta(
        `SELECT ativo FROM leadership_lab.participante WHERE id = $1`,
        [id]
      );
      expect(ativo).toBe(true);
    });

    it("recusa corpo sem 'ativo', com valor que não é booleano ou com campo a mais", async () => {
      const a = await par(opA);
      const id = await amb.vincular(a.usuario.id, a.employeeId);
      for (const corpo of [{}, { ativo: "sim" }, { ativo: false, userId: a.usuario.id }]) {
        expect((await amb.http(rhA, "PATCH", `/participantes/${id}`, corpo)).status).toBe(400);
      }
    });
  });

  describe("escopo: a lista e o cadastro concordam em todas as formas de UserScope", () => {
    // Duas políticas diferentes respondem à mesma pergunta (a listagem usa `operationWhere`, a
    // ação sobre um alvo usa `canAccessScope`). Este teste as obriga a concordar.
    it("global, por empresa, por operação, por unidade, sem escopo e escopo vazio", async () => {
      const dentro = await par(opA);
      const fora = await par(opB);
      const idDentro = await amb.vincular(dentro.usuario.id, dentro.employeeId);
      const idFora = await amb.vincular(fora.usuario.id, fora.employeeId);

      // Colaboradores livres, um em cada operação, para testar o cadastro.
      const livreA = await par(opA);
      const livreB = await par(opB);

      const casos: Array<{
        nome: string;
        pessoa: () => Promise<Pessoa>;
        enxerga: { a: boolean; b: boolean };
      }> = [
        { nome: "global", pessoa: () => amb.rhGlobal(), enxerga: { a: true, b: true } },
        {
          nome: "por empresa",
          pessoa: () => amb.pessoa("RH", [{ companyId: opA.companyId }]),
          enxerga: { a: true, b: false }
        },
        {
          nome: "por operação",
          pessoa: () => amb.pessoa("RH", [{ operationId: opB.operationId }]),
          enxerga: { a: false, b: true }
        },
        {
          nome: "por unidade",
          pessoa: () => amb.pessoa("RH", [{ unitId: opA.unitId }]),
          enxerga: { a: true, b: false }
        },
        {
          nome: "empresa e operação de empresas diferentes",
          pessoa: () =>
            amb.pessoa("RH", [{ companyId: opA.companyId, operationId: opB.operationId }]),
          enxerga: { a: false, b: false }
        },
        { nome: "sem escopo", pessoa: () => amb.pessoa("RH"), enxerga: { a: false, b: false } },
        {
          nome: "escopo vazio, que não é global",
          pessoa: () => amb.pessoa("RH", [{}]),
          enxerga: { a: false, b: false }
        }
      ];

      for (const caso of casos) {
        const rh = await caso.pessoa();
        const lista = (
          (await amb.http(rh, "GET", "/participantes")).corpo.data as Array<{ id: string }>
        ).map((p) => p.id);
        expect(lista.includes(idDentro), `${caso.nome}: lista A`).toBe(caso.enxerga.a);
        expect(lista.includes(idFora), `${caso.nome}: lista B`).toBe(caso.enxerga.b);

        for (const [rotulo, alvo, esperado] of [
          ["A", livreA, caso.enxerga.a],
          ["B", livreB, caso.enxerga.b]
        ] as const) {
          // Não consome o colaborador livre: o cadastro só acontece no caso que enxerga.
          const busca = await amb.http(
            rh,
            "GET",
            `/colaboradores-elegiveis?busca=${encodeURIComponent(
              (
                await amb.consulta(`SELECT identifier FROM "Employee" WHERE id = $1`, [
                  alvo.employeeId
                ])
              )[0]!.identifier
            )}`
          );
          const achou = (busca.corpo.data as Array<{ id: string }>).some(
            (c) => c.id === alvo.employeeId
          );
          expect(achou, `${caso.nome}: busca ${rotulo}`).toBe(esperado);

          const cadastro = await amb.http(rh, "POST", "/participantes", {
            userId: alvo.usuario.id,
            employeeId: alvo.employeeId
          });
          expect(cadastro.status, `${caso.nome}: cadastro ${rotulo}`).toBe(esperado ? 200 : 404);
          if (esperado) {
            // Devolve o colaborador ao estado livre para os próximos casos.
            await amb.consulta(`DELETE FROM leadership_lab.participante WHERE id = $1`, [
              cadastro.corpo.data.id
            ]);
          }
        }
      }
    });
  });

  describe("buscar colaboradores e usuários elegíveis", () => {
    it("exige uma busca de pelo menos 2 letras: não lista todo mundo", async () => {
      for (const caminho of [
        "/colaboradores-elegiveis",
        "/colaboradores-elegiveis?busca=",
        "/colaboradores-elegiveis?busca=a",
        "/colaboradores-elegiveis?busca=%20a%20",
        "/colaboradores-elegiveis?busca=ab&todos=1",
        "/usuarios-elegiveis",
        "/usuarios-elegiveis?busca=a"
      ]) {
        const r = await amb.http(rhGlobal, "GET", caminho);
        expect(r.status, caminho).toBe(400);
      }
    });

    it("acha por nome ou matrícula, sem diferenciar maiúsculas, e só quem ainda é elegível", async () => {
      const sufixo = crypto.randomUUID().slice(0, 8);
      const marca = `Zeferino${sufixo}`;
      const ativo = await amb.colaborador({ name: `${marca} Ativo`, identifier: `ZE-${sufixo}-1` });
      const ferias = await amb.colaborador({
        name: `${marca} Férias`,
        status: "VACATION",
        identifier: `ZE-${sufixo}-2`
      });
      const desligado = await amb.colaborador({
        name: `${marca} Desligado`,
        status: "TERMINATED",
        identifier: `ZE-${sufixo}-3`
      });
      const arquivado = await amb.colaborador({
        name: `${marca} Arquivado`,
        recordStatus: "ARCHIVED",
        identifier: `ZE-${sufixo}-4`
      });
      const jaLigado = await amb.colaborador({
        name: `${marca} Ligado`,
        identifier: `ZE-${sufixo}-5`
      });
      await amb.vincular((await amb.usuarioComum()).id, jaLigado);
      const emOutraOp = await amb.colaborador(
        { name: `${marca} Em B`, identifier: `ZE-${sufixo}-6` },
        opB
      );

      const ids = async (quem: Pessoa, busca: string) =>
        (
          (
            await amb.http(
              quem,
              "GET",
              `/colaboradores-elegiveis?busca=${encodeURIComponent(busca)}`
            )
          ).corpo.data as Array<{ id: string }>
        ).map((c) => c.id);

      const global = await ids(rhGlobal, marca.toUpperCase());
      expect(global.sort()).toEqual([ativo, ferias, emOutraOp].sort());
      expect(global).not.toContain(desligado);
      expect(global).not.toContain(arquivado);
      expect(global).not.toContain(jaLigado);

      // O escopo restringe, e a matrícula também busca.
      expect((await ids(rhA, marca.toLowerCase())).sort()).toEqual([ativo, ferias].sort());
      expect(await ids(rhA, `ze-${sufixo}-1`)).toEqual([ativo]);
      expect(await ids(rhB, marca)).toEqual([emOutraOp]);
    });

    it("devolve no máximo 20 e só os campos do contrato", async () => {
      const marca = `Lote${crypto.randomUUID().slice(0, 8)}`;
      for (let i = 0; i < 22; i++) {
        await amb.colaborador({
          name: `${marca} ${String(i).padStart(2, "0")}`,
          identifier: `${marca}-${i}`
        });
      }
      const r = await amb.http(rhGlobal, "GET", `/colaboradores-elegiveis?busca=${marca}`);
      expect(r.corpo.data).toHaveLength(20);
      for (const c of r.corpo.data) labColaboradorDoCadastroSchema.parse(c);
      // Em ordem de nome.
      const nomes = r.corpo.data.map((c: { nome: string }) => c.nome);
      expect(nomes).toEqual([...nomes].sort());
    });

    it("usuários: só os de perfil comum, ativos e sem vínculo", async () => {
      const marca = `Usr${crypto.randomUUID().slice(0, 8)}`;
      const livre = await amb.usuarioComum({
        name: `${marca} livre`,
        email: `${marca}-livre@teste.local`
      });
      const ligado = await amb.usuarioComum({
        name: `${marca} ligado`,
        email: `${marca}-ligado@teste.local`
      });
      await amb.vincular(ligado.id, await amb.colaborador());
      await amb.usuarioComum({
        name: `${marca} inativo`,
        email: `${marca}-inativo@teste.local`,
        isActive: false
      });
      await amb.pessoa("RH", [], { name: `${marca} rh`, email: `${marca}-rh@teste.local` });
      await amb.pessoa("ADMIN", [], {
        name: `${marca} admin`,
        email: `${marca}-admin@teste.local`
      });

      const r = await amb.http(rhA, "GET", `/usuarios-elegiveis?busca=${marca.toUpperCase()}`);
      expect(r.status).toBe(200);
      expect(r.corpo.data).toHaveLength(1);
      expect(labUsuarioElegivelSchema.parse(r.corpo.data[0])).toEqual({
        id: livre.id,
        nome: `${marca} livre`,
        email: `${marca}-livre@teste.local`
      });
      // Também acha pelo e-mail.
      const porEmail = await amb.http(rhA, "GET", `/usuarios-elegiveis?busca=${marca}-livre@`);
      expect(porEmail.corpo.data.map((u: { id: string }) => u.id)).toEqual([livre.id]);
      expect(JSON.stringify(r.corpo)).not.toMatch(/passwordHash/i);
    });
  });
});
