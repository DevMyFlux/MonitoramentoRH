// Motor do teste: as consultas da tela de início (termo e moldes). PostgreSQL real; exige
// LAB_TEST_DATABASE_URL (sem ela, é ignorado).
import type { LabAtor } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { inserir } from "../db/test-fixtures.js";
import { type Banco, encerrarBanco, novoCenario, prepararBanco } from "./cenario-de-teste.js";

describe.skipIf(!integrationEnabled)("motor do teste: consultas do participante", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  const intruso = (role: LabAtor["role"], participanteId: string | null = null): LabAtor => ({
    userId: crypto.randomUUID(),
    role,
    participanteId,
    permissoes: []
  });

  describe("situação do termo de ciência", () => {
    it("antes do aceite: não aceito; depois: aceito, com a data do aceite", async () => {
      const c = await novoCenario(banco, { termoAceito: false });
      expect(await c.motor.situacaoDoTermo(c.ator)).toEqual({
        versaoAtual: "2026-1",
        aceito: false,
        aceitoEm: null
      });

      const aceite = await c.motor.aceitarTermo(c.ator);
      expect(await c.motor.situacaoDoTermo(c.ator)).toEqual({
        versaoAtual: "2026-1",
        aceito: true,
        aceitoEm: aceite.aceitoEm
      });
    });

    it("o aceite de uma versão antiga não conta para a atual", async () => {
      const c = await novoCenario(banco, { termoAceito: false });
      await consulta(
        `INSERT INTO leadership_lab.termo_aceite (participante_id, versao_termo) VALUES ($1, '2025-0')`,
        [c.ctx.participanteId]
      );
      expect(await c.motor.situacaoDoTermo(c.ator)).toMatchObject({
        aceito: false,
        aceitoEm: null
      });
    });

    it("cada participante vê só o próprio aceite", async () => {
      const aceitou = await novoCenario(banco);
      const naoAceitou = await novoCenario(banco, { termoAceito: false });
      expect((await aceitou.motor.situacaoDoTermo(aceitou.ator)).aceito).toBe(true);
      expect((await naoAceitou.motor.situacaoDoTermo(naoAceitou.ator)).aceito).toBe(false);
    });

    it("só o participante consulta", async () => {
      const c = await novoCenario(banco);
      for (const ator of [intruso("RH"), intruso("ADMIN"), intruso("DEV")]) {
        await expect(c.motor.situacaoDoTermo(ator)).rejects.toMatchObject({
          statusCode: 403,
          code: "LAB_FORBIDDEN"
        });
      }
      await expect(c.motor.situacaoDoTermo(intruso("COMUM"))).rejects.toMatchObject({
        code: "LAB_SEM_VINCULO"
      });
    });
  });

  describe("moldes", () => {
    it("lista os três na ordem dos níveis, com o do cargo do participante marcado", async () => {
      const c = await novoCenario(banco); // cargo de supervisor
      const { moldes, meuMoldeId } = await c.motor.listarMoldes(c.ator);

      expect(moldes.map((m) => m.nivel)).toEqual(["encarregado", "supervisor", "coordenador"]);
      expect(moldes.filter((m) => m.doMeuCargo).map((m) => m.nivel)).toEqual(["supervisor"]);
      expect(meuMoldeId).toBe(moldes.find((m) => m.nivel === "supervisor")?.id);
    });

    it("só o molde liberado mostra o tempo; os demais, nenhum", async () => {
      const c = await novoCenario(banco);
      const { moldes } = await c.motor.listarMoldes(c.ator);
      const porNivel = Object.fromEntries(moldes.map((m) => [m.nivel, m]));
      expect(porNivel.supervisor).toMatchObject({
        disponivel: true,
        tempoLimiteS: 60,
        numeroSituacoes: 5
      });
      expect(porNivel.supervisor?.temas).toContain("Prioridade de OS");
      expect(porNivel.coordenador).toMatchObject({ disponivel: false, tempoLimiteS: null });
    });

    it("um molde desativado esconde o tempo, mesmo com o tempo ainda definido no banco", async () => {
      await consulta(
        `UPDATE leadership_lab.molde SET ativo = false, tempo_limite_s = 45 WHERE nivel = 'encarregado'`
      );
      const c = await novoCenario(banco);
      const { moldes } = await c.motor.listarMoldes(c.ator);
      expect(moldes.find((m) => m.nivel === "encarregado")).toMatchObject({
        disponivel: false,
        tempoLimiteS: null
      });
    });

    it("sem cargo informado, ou com cargo sem molde, lista tudo sem marcar nenhum (e sem erro)", async () => {
      const semCargo = await novoCenario(banco, { nivel: null });
      const funcao = await inserir(banco.db.client, '"JobFunction"', {
        id: crypto.randomUUID(),
        name: "Cargo sem teste",
        updatedAt: new Date().toISOString()
      });
      const semMolde = await novoCenario(banco, {
        nivel: null,
        colaborador: { functionId: funcao }
      });

      for (const c of [semCargo, semMolde]) {
        const { moldes, meuMoldeId } = await c.motor.listarMoldes(c.ator);
        expect(moldes).toHaveLength(3);
        expect(meuMoldeId).toBeNull();
        expect(moldes.some((m) => m.doMeuCargo)).toBe(false);
      }
    });

    it("expõe só os campos da tela, nunca quem configurou nem datas internas", async () => {
      const c = await novoCenario(banco);
      const { moldes } = await c.motor.listarMoldes(c.ator);
      for (const molde of moldes) {
        expect(Object.keys(molde).sort()).toEqual([
          "disponivel",
          "doMeuCargo",
          "id",
          "nivel",
          "nome",
          "numeroSituacoes",
          "temas",
          "tempoLimiteS"
        ]);
      }
    });

    it("só o participante consulta", async () => {
      const c = await novoCenario(banco);
      for (const ator of [
        intruso("RH"),
        intruso("ADMIN"),
        intruso("DEV"),
        intruso("RH", c.ctx.participanteId)
      ]) {
        await expect(c.motor.listarMoldes(ator)).rejects.toMatchObject({ statusCode: 403 });
      }
      await expect(c.motor.listarMoldes(intruso("COMUM"))).rejects.toMatchObject({
        code: "LAB_SEM_VINCULO"
      });
    });
  });
});
