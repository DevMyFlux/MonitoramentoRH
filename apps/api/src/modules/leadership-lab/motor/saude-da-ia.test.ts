// Fumaça da saúde da IA: o estado que DEV e ADMIN veem distingue serviço fora, serviço antigo e
// modelo inacessível (credencial, nome ou cota), sem expor segredo.
import { describe, expect, it } from "vitest";
import { configDeTeste } from "./cenario-de-teste.js";
import { ClienteIaHttp } from "./cliente-ia-http.js";
import { MotorDoTeste } from "./motor.js";

const SERVICO = {
  agentes: ["suporte"],
  recursos_suporte: ["escopo", "pessoa", "meus_resultados", "fora_do_escopo"],
  versao_instrucao: "v1"
};

function motorCom(modelo: { status: number; corpo: unknown }, chamadas: string[] = []) {
  const ia = new ClienteIaHttp({
    baseUrl: "http://ia.local",
    token: "segredo-do-servico",
    timeoutMs: 1000,
    fetchImpl: (async (url: URL) => {
      chamadas.push(url.pathname);
      return url.pathname === "/saude/modelo"
        ? new Response(JSON.stringify(modelo.corpo), { status: modelo.status })
        : new Response(JSON.stringify(SERVICO));
    }) as unknown as typeof fetch
  });
  return new MotorDoTeste({ db: {} as never, ia, config: configDeTeste() });
}

describe("saúde da IA", () => {
  it("serviço e modelo respondendo: ok", async () => {
    const chamadas: string[] = [];
    const estado = await motorCom(
      { status: 200, corpo: { ok: true, modelo: "m" } },
      chamadas
    ).estadoDoSuporte();
    expect(estado).toEqual({ estado: "ok", versao: "v1", detalhe: null });
    expect(chamadas).toEqual(["/", "/saude/modelo"]);
  });

  it("modelo inacessível: indisponível, dizendo o modelo e o tipo da falha", async () => {
    const estado = await motorCom({
      status: 200,
      corpo: { ok: false, modelo: "gemini-x", erro: "NotFound" }
    }).estadoDoSuporte();
    expect(estado.estado).toBe("indisponivel");
    expect(estado.detalhe).toContain("gemini-x");
    expect(estado.detalhe).toContain("NotFound");
    expect(estado.detalhe).not.toContain("segredo-do-servico");
  });

  it("serviço sem a checagem de modelo (versão anterior): desatualizado", async () => {
    const estado = await motorCom({ status: 404, corpo: {} }).estadoDoSuporte();
    expect(estado.estado).toBe("desatualizado");
    expect(estado.detalhe).toMatch(/Reimplante/);
  });
});
