// O modo demonstração de ponta a ponta no servidor: a IA de exemplo passando pelo motor de verdade
// (PostgreSQL real) e o preparo do participante. Exige LAB_TEST_DATABASE_URL (sem ela, é ignorado).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { criarUsuario, inserir } from "../db/test-fixtures.js";
import {
  type Banco,
  TEMPO_LIMITE_S,
  configDeTeste,
  encerrarBanco,
  novoCenario,
  prepararBanco
} from "../motor/cenario-de-teste.js";
import type { LabEscolha } from "@my-flux/shared";
import {
  EMAIL_DO_ADMIN_DE_DEMONSTRACAO,
  EMAIL_DO_PARTICIPANTE_DE_DEMONSTRACAO,
  IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO,
  NOME_DA_OPERACAO_DE_DEMONSTRACAO,
  NOME_DO_CARGO_DE_DEMONSTRACAO,
  TEMPO_DA_DEMONSTRACAO_S,
  prepararDemonstracao
} from "./preparar.js";
import { IaDemonstracao } from "./ia-demonstracao.js";
import { PREFIXO_DA_DEMONSTRACAO } from "./conteudo.js";
import { MotorDoTeste } from "../motor/motor.js";
import type { RespostaDoTeste } from "../motor/visoes.js";

describe.skipIf(!integrationEnabled)("modo demonstração", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  // -------------------------------------------------------------------------
  describe("uma partida com a IA de demonstração, pelo motor de verdade", () => {
    async function partida(escolhas: Array<LabEscolha | null>) {
      const c = await novoCenario(banco);
      const motor = new MotorDoTeste({
        db: banco.prisma,
        ia: new IaDemonstracao(),
        config: { ...configDeTeste(), demonstracao: true },
        agora: c.relogio.agora
      });
      let atual: RespostaDoTeste = await motor.iniciar(c.ator);
      const respostas = [atual];
      for (const escolha of escolhas) {
        if (atual.tipo !== "situacao") throw new Error("o teste acabou antes das escolhas");
        // Omissão: o servidor só aceita o aviso depois que o prazo (60 s) passou.
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

    it("termina com resultado, e as situações mostradas são as de demonstração", async () => {
      const { respostas, final } = await partida(["A", "C", "B", "A", "C"]);
      expect(final.tipo).toBe("resultado");
      const situacoes = respostas.flatMap((r) => (r.tipo === "situacao" ? [r.situacao] : []));
      expect(situacoes).toHaveLength(5);
      for (const s of situacoes) expect(s.texto.startsWith(PREFIXO_DA_DEMONSTRACAO)).toBe(true);
      expect(situacoes.map((s) => s.marco)).toEqual([false, false, true, false, false]);
    });

    it("os números do resultado são calculados pelo backend a partir das escolhas (nada vem da IA)", async () => {
      const { final } = await partida(["A", "C", "B", "A", "C"]);
      if (final.tipo !== "resultado") throw new Error("esperava o resultado");
      // As cinco melhores respostas: nota 100 em todas.
      expect(final.resultado.aderenciaGeral).toBe(100);
      expect(final.resultado.situacoes.map((s) => s.aderencia)).toEqual([100, 100, 100, 100, 100]);
      expect(final.resultado.statusValidacao).toBe("aguardando_validacao");
      expect(final.resultado.resumo).toContain("demonstração");
    });

    it("escolhas de notas diferentes dão a média certa e os níveis por skill", async () => {
      // 1B=40, 2A=70, 3C=70, 4B=40, 5A=40 -> média 52
      const { final } = await partida(["B", "A", "C", "B", "A"]);
      if (final.tipo !== "resultado") throw new Error("esperava o resultado");
      expect(final.resultado.situacoes.map((s) => s.aderencia)).toEqual([40, 70, 70, 40, 40]);
      expect(final.resultado.aderenciaGeral).toBe(52);
      expect(final.resultado.niveisPorSkill.length).toBeGreaterThan(0);
    });

    it("a escolha de nota 10 (situação 4, opção C) abre um alerta vermelho para o curador", async () => {
      const { c, final } = await partida(["A", "C", "B", "C", "C"]);
      if (final.tipo !== "resultado") throw new Error("esperava o resultado");
      const alertas = await consulta(
        `SELECT a.cor, t.numero FROM leadership_lab.alerta a
           JOIN leadership_lab.turno t ON t.id = a.turno_id
           JOIN leadership_lab.sessao s ON s.id = a.sessao_id
          WHERE s.participante_id = $1`,
        [c.ctx.participanteId]
      );
      expect(alertas).toEqual([{ cor: "vermelho", numero: 4 }]);
    });

    it("tempo esgotado conta como omissão (nota 0) e o teste segue até o fim", async () => {
      const { final } = await partida([null, "C", "B", "A", "C"]);
      if (final.tipo !== "resultado") throw new Error("esperava o resultado");
      expect(final.resultado.situacoes[0]).toMatchObject({
        tempoEsgotado: true,
        escolha: null,
        aderencia: 0
      });
    });

    it("o painel depois do teste diz que é demonstração e já traz os números", async () => {
      const { motor, c } = await partida(["A", "C", "B", "A", "C"]);
      const painel = await motor.painel(c.ator);
      expect(painel.demonstracao).toBe(true);
      expect(painel.indicadores.testesFeitos).toBe(1);
    });

    it("o texto livre vai pela Guarda e não aparece em lugar nenhum do resultado", async () => {
      const c = await novoCenario(banco);
      const motor = new MotorDoTeste({
        db: banco.prisma,
        ia: new IaDemonstracao(),
        config: configDeTeste(),
        agora: c.relogio.agora
      });
      const aberta = await motor.iniciar(c.ator);
      if (aberta.tipo !== "situacao") throw new Error("esperava a situação 1");
      c.relogio.avancar(5_000);
      await motor.responder(c.ator, aberta.sessaoId, {
        numero: 1,
        escolha: "A",
        textoLivre: "SEGREDO-DO-TEXTO-LIVRE"
      });
      const contribuicoes = await consulta(
        `SELECT 1 FROM leadership_lab.contribuicao WHERE sessao_id = $1`,
        [aberta.sessaoId]
      );
      expect(contribuicoes).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("preparar o participante de demonstração", () => {
    const mensagens: string[] = [];
    const logger = {
      info: (m: string) => mensagens.push(m),
      warn: (m: string) => mensagens.push(m)
    };

    /** Um banco novo, com o que o seed cria: perfil COMUM, operação e a conta de demonstração. */
    async function bancoComSeed(opcoes: { perfil?: string } = {}) {
      const novo = await prepararBanco();
      if (opcoes.perfil) {
        await novo.db.client.query(`UPDATE "Role" SET name = $1`, [opcoes.perfil]);
      }
      const userId = await criarUsuario(novo.db.client, novo.base, {
        email: EMAIL_DO_PARTICIPANTE_DE_DEMONSTRACAO
      });
      return { novo, userId };
    }

    it("deixa tudo pronto: molde liberado, cargo, colaborador fictício e participante ligado à conta", async () => {
      const { novo, userId } = await bancoComSeed();
      try {
        const resultado = await prepararDemonstracao(novo.prisma, logger);
        expect(resultado).toEqual({ preparado: true });

        const q = (sql: string, params: unknown[] = []) =>
          novo.db.client.query(sql, params).then((r) => r.rows);
        // prepararBanco já liberou o molde com 60 s; um tempo definido é respeitado.
        expect(
          await q(
            `SELECT ativo, tempo_limite_s FROM leadership_lab.molde WHERE nivel = 'supervisor'`
          )
        ).toEqual([{ ativo: true, tempo_limite_s: 60 }]);
        expect(
          await q(
            `SELECT e.identifier, e.name, j.name AS cargo, e.notes
               FROM leadership_lab.participante p
               JOIN "Employee" e ON e.id = p.employee_id
               JOIN "JobFunction" j ON j.id = e."functionId"
              WHERE p.user_id = $1`,
            [userId]
          )
        ).toMatchObject([
          {
            identifier: IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO,
            cargo: NOME_DO_CARGO_DE_DEMONSTRACAO,
            notes: expect.stringContaining("fictício")
          }
        ]);
        expect(
          await q(
            `SELECT 1 FROM leadership_lab.molde_cargo mc
               JOIN "JobFunction" j ON j.id = mc.job_function_id
              WHERE j.name = $1`,
            [NOME_DO_CARGO_DE_DEMONSTRACAO]
          )
        ).toHaveLength(1);
        // O colaborador fictício fica numa operação fictícia, só da demonstração: nenhuma operação
        // real (a do banco, aqui) ganha esse colaborador nas listas ou nas escalas.
        expect(
          await q(
            `SELECT o.name FROM "Employee" e JOIN "Operation" o ON o.id = e."operationId"
              WHERE e.identifier = $1`,
            [IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO]
          )
        ).toEqual([{ name: NOME_DA_OPERACAO_DE_DEMONSTRACAO }]);
        expect(
          await q(`SELECT 1 FROM "Employee" WHERE "operationId" = $1`, [novo.base.operationId])
        ).toHaveLength(0);
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("liberar o molde preenche o que falta: molde inativo e sem tempo recebe o tempo da demonstração", async () => {
      const { novo } = await bancoComSeed();
      try {
        await novo.db.client.query(
          `UPDATE leadership_lab.molde SET ativo = false, tempo_limite_s = NULL WHERE nivel = 'supervisor'`
        );
        await prepararDemonstracao(novo.prisma, logger);
        const { rows } = await novo.db.client.query(
          `SELECT ativo, tempo_limite_s FROM leadership_lab.molde WHERE nivel = 'supervisor'`
        );
        expect(rows).toEqual([{ ativo: true, tempo_limite_s: TEMPO_DA_DEMONSTRACAO_S }]);
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("num banco como o do seed, sem nenhuma operação cadastrada, o modo cria a sua e funciona", async () => {
      const { novo } = await bancoComSeed();
      try {
        // O seed do repositório só cria perfis e contas: nada de empresa, operação ou colaborador.
        await novo.db.client.query(`DELETE FROM "Operation"`);
        await novo.db.client.query(`DELETE FROM "Unit"`);
        await novo.db.client.query(`DELETE FROM "Client"`);
        await novo.db.client.query(`DELETE FROM "Company"`);

        const resultado = await prepararDemonstracao(novo.prisma, logger);

        expect(resultado).toEqual({ preparado: true });
        const { rows } = await novo.db.client.query(
          `SELECT (SELECT count(*) FROM "Operation")::int AS operacoes,
                  (SELECT count(*) FROM leadership_lab.participante)::int AS participantes`
        );
        expect(rows[0]).toEqual({ operacoes: 1, participantes: 1 });
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("com operações reais cadastradas, nenhuma é tocada: o modo cria só a dele", async () => {
      const { novo } = await bancoComSeed();
      try {
        const antes = (await novo.db.client.query(`SELECT id, name FROM "Operation" ORDER BY name`))
          .rows;
        await prepararDemonstracao(novo.prisma, logger);
        const depois = (
          await novo.db.client.query(
            `SELECT id, name FROM "Operation" WHERE name <> $1 ORDER BY name`,
            [NOME_DA_OPERACAO_DE_DEMONSTRACAO]
          )
        ).rows;
        expect(depois).toEqual(antes);
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("um tempo que o negócio já definiu é preservado, mesmo com o molde inativo: só ativa", async () => {
      const { novo } = await bancoComSeed();
      try {
        await novo.db.client.query(
          `UPDATE leadership_lab.molde SET ativo = false, tempo_limite_s = 120 WHERE nivel = 'supervisor'`
        );
        await prepararDemonstracao(novo.prisma, logger);
        const { rows } = await novo.db.client.query(
          `SELECT ativo, tempo_limite_s FROM leadership_lab.molde WHERE nivel = 'supervisor'`
        );
        expect(rows).toEqual([{ ativo: true, tempo_limite_s: 120 }]);
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("repetir não duplica nada (cada subida do servidor chama de novo)", async () => {
      const { novo } = await bancoComSeed();
      try {
        const contar = async () =>
          (
            await novo.db.client.query(
              `SELECT (SELECT count(*) FROM leadership_lab.participante)::int AS participantes,
                      (SELECT count(*) FROM "Employee" WHERE identifier = $1)::int AS colaboradores,
                      (SELECT count(*) FROM "JobFunction" WHERE name = $2)::int AS cargos,
                      (SELECT count(*) FROM leadership_lab.molde_cargo)::int AS mapeamentos,
                      (SELECT count(*) FROM "Operation" WHERE name = $3)::int AS operacoes,
                      (SELECT count(*) FROM "Company" WHERE name LIKE 'Demonstração%')::int AS empresas`,
              [
                IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO,
                NOME_DO_CARGO_DE_DEMONSTRACAO,
                NOME_DA_OPERACAO_DE_DEMONSTRACAO
              ]
            )
          ).rows[0];
        await prepararDemonstracao(novo.prisma, logger);
        const primeira = await contar();
        await prepararDemonstracao(novo.prisma, logger);
        await prepararDemonstracao(novo.prisma, logger);
        expect(await contar()).toEqual(primeira);
        expect(primeira).toEqual({
          participantes: 1,
          colaboradores: 1,
          cargos: 1,
          mapeamentos: 1,
          operacoes: 1,
          empresas: 1
        });
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("duas instâncias subindo juntas não quebram (a segunda encontra o que a primeira criou)", async () => {
      const { novo } = await bancoComSeed();
      try {
        const resultados = await Promise.all([
          prepararDemonstracao(novo.prisma, logger),
          prepararDemonstracao(novo.prisma, logger),
          prepararDemonstracao(novo.prisma, logger)
        ]);
        expect(resultados.every((r) => r.preparado)).toBe(true);
        const { rows } = await novo.db.client.query(
          `SELECT (SELECT count(*) FROM leadership_lab.participante)::int AS participantes,
                  (SELECT count(*) FROM "Employee" WHERE identifier = $1)::int AS colaboradores,
                  (SELECT count(*) FROM "JobFunction" WHERE name = $2)::int AS cargos,
                  (SELECT count(*) FROM leadership_lab.molde_cargo)::int AS mapeamentos,
                  (SELECT count(*) FROM "Operation" WHERE name = $3)::int AS operacoes,
                  (SELECT count(*) FROM "Company" WHERE name LIKE 'Demonstração%')::int AS empresas`,
          [
            IDENTIFICADOR_DO_COLABORADOR_DE_DEMONSTRACAO,
            NOME_DO_CARGO_DE_DEMONSTRACAO,
            NOME_DA_OPERACAO_DE_DEMONSTRACAO
          ]
        );
        // Nada duplicado: nem o cargo, que não tem restrição de unicidade no banco.
        expect(rows[0]).toEqual({
          participantes: 1,
          colaboradores: 1,
          cargos: 1,
          mapeamentos: 1,
          operacoes: 1,
          empresas: 1
        });
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("sem a conta de demonstração no banco, não cria nada e explica por quê (não derruba)", async () => {
      const novo = await prepararBanco();
      try {
        const resultado = await prepararDemonstracao(novo.prisma, logger);
        expect(resultado).toMatchObject({
          preparado: false,
          motivo: expect.stringContaining("não existe")
        });
        const { rows } = await novo.db.client.query(
          `SELECT (SELECT count(*) FROM leadership_lab.participante)::int AS p,
                  (SELECT count(*) FROM "Employee")::int AS e`
        );
        expect(rows[0]).toEqual({ p: 0, e: 0 });
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("uma conta que não é COMUM não vira participante", async () => {
      const { novo } = await bancoComSeed({ perfil: "RH" });
      try {
        const resultado = await prepararDemonstracao(novo.prisma, logger);
        expect(resultado).toMatchObject({
          preparado: false,
          motivo: expect.stringContaining("COMUM")
        });
        const { rows } = await novo.db.client.query(
          `SELECT count(*)::int AS n FROM leadership_lab.participante`
        );
        expect(rows[0]?.n).toBe(0);
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("uma conta já ligada a um colaborador real é respeitada: nada é criado nem alterado", async () => {
      const { novo, userId } = await bancoComSeed();
      try {
        const colaboradorReal = await inserir(novo.db.client, '"Employee"', {
          id: crypto.randomUUID(),
          operationId: novo.base.operationId,
          name: "Maria Real",
          identifier: "MAT-REAL",
          updatedAt: new Date().toISOString()
        });
        await inserir(novo.db.client, "leadership_lab.participante", {
          user_id: userId,
          employee_id: colaboradorReal
        });

        const resultado = await prepararDemonstracao(novo.prisma, logger);

        // O colaborador real não tem cargo com teste: avisa e não mexe.
        expect(resultado).toMatchObject({ preparado: false });
        const { rows } = await novo.db.client.query(
          `SELECT (SELECT count(*) FROM "Employee")::int AS e,
                  (SELECT count(*) FROM "JobFunction" WHERE name = $1)::int AS cargos,
                  (SELECT "functionId" FROM "Employee" WHERE id = $2) AS cargo_da_maria`,
          [NOME_DO_CARGO_DE_DEMONSTRACAO, colaboradorReal]
        );
        expect(rows[0]).toEqual({ e: 1, cargos: 0, cargo_da_maria: null });
      } finally {
        await encerrarBanco(novo);
      }
    });

    it("depois de preparado, a conta de demonstração faz um teste inteiro (termo, início e resultado)", async () => {
      const { novo, userId } = await bancoComSeed();
      try {
        await prepararDemonstracao(novo.prisma, logger);
        const { rows } = await novo.db.client.query(
          `SELECT id FROM leadership_lab.participante WHERE user_id = $1`,
          [userId]
        );
        const motor = new MotorDoTeste({
          db: novo.prisma,
          ia: new IaDemonstracao(),
          config: { ...configDeTeste(), demonstracao: true }
        });
        const ator = {
          userId,
          role: "COMUM" as const,
          participanteId: rows[0]?.id as string,
          permissoes: []
        };
        await motor.aceitarTermo(ator);
        let atual: RespostaDoTeste = await motor.iniciar(ator);
        for (const escolha of ["A", "C", "B", "A", "C"] as const) {
          if (atual.tipo !== "situacao") throw new Error("acabou antes");
          atual = await motor.responder(ator, atual.sessaoId, {
            numero: atual.situacao.numero,
            escolha
          });
        }
        expect(atual.tipo).toBe("resultado");
      } finally {
        await encerrarBanco(novo);
      }
    });
  });

  it("dá lab_gestao e lab_especialista à conta de administração, uma vez, sem mexer nas outras", async () => {
    const id = await inserir(banco.db.client, '"User"', {
      id: crypto.randomUUID(),
      email: EMAIL_DO_ADMIN_DE_DEMONSTRACAO,
      name: "Admin",
      passwordHash: "x",
      roleId: banco.base.roleId,
      updatedAt: new Date().toISOString()
    });
    const outro = await criarUsuario(banco.db.client, banco.base, {});
    await prepararDemonstracao(banco.prisma);
    await prepararDemonstracao(banco.prisma);
    const q = (u: string) =>
      consulta(
        "SELECT permissao FROM leadership_lab.permissao_usuario WHERE user_id = $1 ORDER BY 1",
        [u]
      );
    expect(await q(id)).toEqual([{ permissao: "lab_especialista" }, { permissao: "lab_gestao" }]);
    expect(await q(outro)).toEqual([]);
  });
});
