import { describe, expect, it } from "vitest";
import { criarIdTokenDoCloudRun } from "./id-token-cloud-run.js";

function jwt(expSegundos: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSegundos })).toString("base64url");
  return `cabecalho.${payload}.assinatura`;
}

function metadadosFalsos(respostas: Array<{ status: number; corpo: string }>) {
  const chamadas: Array<{ url: string; cabecalhos: Record<string, string> }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, cabecalhos: init?.headers as Record<string, string> });
    const r = respostas.shift() ?? { status: 500, corpo: "" };
    return new Response(r.corpo, { status: r.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, chamadas };
}

describe("criarIdTokenDoCloudRun", () => {
  it("pede o token ao metadados com a ORIGEM do serviço como público", async () => {
    const { fetchImpl, chamadas } = metadadosFalsos([{ status: 200, corpo: jwt(4_000_000_000) }]);
    const obter = criarIdTokenDoCloudRun("https://lab-ia-123.a.run.app/v1/", { fetchImpl });

    expect(await obter()).toBe(jwt(4_000_000_000));
    expect(chamadas[0]?.url).toContain(
      `audience=${encodeURIComponent("https://lab-ia-123.a.run.app")}`
    );
    expect(chamadas[0]?.cabecalhos["Metadata-Flavor"]).toBe("Google");
  });

  it("reusa o token até 5 minutos antes de expirar, depois busca outro", async () => {
    let agora = 1_000_000;
    const exp = (agora + 60 * 60_000) / 1000; // vence em 1 hora
    const { fetchImpl, chamadas } = metadadosFalsos([
      { status: 200, corpo: jwt(exp) },
      { status: 200, corpo: jwt(exp + 3600) }
    ]);
    const obter = criarIdTokenDoCloudRun("https://ia.exemplo.test", { fetchImpl, agora: () => agora });

    await obter();
    agora += 50 * 60_000; // faltam 10 minutos: ainda vale
    await obter();
    expect(chamadas).toHaveLength(1);

    agora += 6 * 60_000; // faltam 4 minutos: renova
    expect(await obter()).toBe(jwt(exp + 3600));
    expect(chamadas).toHaveLength(2);
  });

  it("lança quando o metadados falha ou devolve vazio", async () => {
    const falha = metadadosFalsos([{ status: 404, corpo: "" }]);
    await expect(criarIdTokenDoCloudRun("https://ia.exemplo.test", falha)()).rejects.toThrow(/404/);

    const vazio = metadadosFalsos([{ status: 200, corpo: "  " }]);
    await expect(criarIdTokenDoCloudRun("https://ia.exemplo.test", vazio)()).rejects.toThrow(/vazio/);
  });
});
