// No modo por cenários, o espaço de aprendizagem segue a mesma regra do teste: vale o cadastro da
// conta (cargo, nível e área). O cargo do colaborador ligado a um molde é regra do modo antigo, e
// exigi-lo deixava o facilitador indisponível para quem faz o teste normalmente.
// Exige LAB_TEST_DATABASE_URL; sem ela, é ignorado.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { type Banco, encerrarBanco, novoCenario, prepararBanco } from "./cenario-de-teste.js";

describe.skipIf(!integrationEnabled)("aprendizagem no modo por cenários", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  /** Um participante cujo cargo de colaborador não está ligado a molde algum. */
  async function semMolde(config: { modoDoTeste: "cenarios" | "legado" }) {
    const c = await novoCenario(banco, { config });
    await banco.db.client.query(
      `DELETE FROM leadership_lab.molde_cargo WHERE job_function_id =
         (SELECT e."functionId" FROM leadership_lab.participante p
            JOIN "Employee" e ON e.id = p.employee_id WHERE p.id = $1)`,
      [c.ctx.participanteId]
    );
    return c;
  }
  const comCadastro = (userId: string) =>
    banco.db.client.query(
      `UPDATE "User" SET "cargo" = 'Coordenadora', "nivelGovernanca" = 'coordenador'::"NivelGovernanca",
              "areaId" = (SELECT id FROM "Area" WHERE slug = 'administrativo') WHERE id = $1`,
      [userId]
    );

  it("com o cadastro da conta completo, responde com o molde do público dela", async () => {
    const c = await semMolde({ modoDoTeste: "cenarios" });
    await comCadastro(c.ctx.userId);
    const r = await c.motor.aprender(c.ator, { mensagem: "Como priorizar?" });
    expect(r.desfecho).toBe("respondida");
    expect(JSON.parse(c.ia.corposPorAlvo.conversa[0]!)).toMatchObject({ molde: "coordenador" });
  });

  it("sem cadastro na conta, diz o que falta", async () => {
    const c = await semMolde({ modoDoTeste: "cenarios" });
    await expect(c.motor.aprender(c.ator, { mensagem: "Oi" })).rejects.toMatchObject({
      statusCode: 409
    });
    expect(c.ia.chamadas.conversa).toBe(0);
  });

  it("no modo legado, a regra do cargo continua a mesma", async () => {
    const c = await semMolde({ modoDoTeste: "legado" });
    await comCadastro(c.ctx.userId);
    await expect(c.motor.aprender(c.ator, { mensagem: "Oi" })).rejects.toMatchObject({
      code: "LAB_MOLDE_NAO_MAPEADO"
    });
  });
});
