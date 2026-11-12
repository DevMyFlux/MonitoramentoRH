// Revisão: resultado experimental com a trava LAB_EXIGE_BASE_VALIDADA ligada. Fica em arquivo
// próprio porque cada arquivo sobe o seu aplicativo (a conexão do Prisma é única por processo).
// Exige LAB_TEST_DATABASE_URL.
import { labFichaDeRevisaoSchema } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import type { Pessoa } from "../cadastro/ambiente-do-cadastro.js";
import { AmbienteDaCuradoria } from "./ambiente-da-curadoria.js";

describe.skipIf(!integrationEnabled)("revisão: resultado experimental", () => {
  let amb: AmbienteDaCuradoria;
  let rh: Pessoa;

  beforeAll(async () => {
    amb = await AmbienteDaCuradoria.subir({ exigeBaseValidada: true });
    rh = await amb.curador();
  }, 60_000);

  afterAll(async () => {
    await amb?.encerrar();
  });

  it("a ficha avisa que o resultado é experimental e, com a trava ligada, ele não é validado", async () => {
    const p = await amb.participanteComTeste();
    await amb.turmaCom(rh, [p]);
    const f = await amb.http(rh, "GET", `/revisao/${p.resultadoId!}`);
    expect(f.status, JSON.stringify(f.corpo)).toBe(200);
    expect(labFichaDeRevisaoSchema.parse(f.corpo.data).experimental).toBe(true);

    const r = await amb.http(rh, "POST", `/resultados/${p.resultadoId!}/validacao`, {});
    expect(r.status).toBe(409);
    expect(r.corpo.code ?? r.corpo.error?.code).toBe("LAB_RESULTADO_EXPERIMENTAL");
    const [linha] = await amb.consulta(
      "SELECT status_validacao FROM leadership_lab.resultado WHERE id = $1",
      [p.resultadoId]
    );
    expect(linha?.status_validacao).toBe("aguardando_validacao");
  });
});
