import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { validarAberturaIa } from "../ia/ia-contrato.js";
import { respostaAberturaExemplo } from "../ia/ia-exemplos.js";
import { ErroDeTransporteIa, chamarIa } from "./cliente-ia.js";
import { ClienteIaHttp, LIMITE_DA_RESPOSTA_BYTES } from "./cliente-ia-http.js";

type Pedido = {
  metodo: string;
  caminho: string;
  cabecalhos: IncomingMessage["headers"];
  corpo: string;
};

const abertos: Server[] = [];

/** Sobe um servidor HTTP de verdade que responde como o teste mandar e registra o que recebe. */
async function servidor(responder: (req: IncomingMessage, res: ServerResponse) => void) {
  const pedidos: Pedido[] = [];
  const s = createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on("data", (p: Buffer) => partes.push(p));
    req.on("end", () => {
      pedidos.push({
        metodo: req.method ?? "",
        caminho: req.url ?? "",
        cabecalhos: req.headers,
        corpo: Buffer.concat(partes).toString("utf8")
      });
      responder(req, res);
    });
  });
  abertos.push(s);
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, pedidos };
}

afterEach(async () => {
  await Promise.all(
    abertos.splice(0).map(
      (s) =>
        new Promise<void>((ok) => {
          s.closeAllConnections();
          s.close(() => ok());
        })
    )
  );
});

const json = (res: ServerResponse, status: number, corpo: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
};

const TOKEN = "token-de-servico-secreto-123";
const cliente = (
  baseUrl: string,
  extra: Partial<ConstructorParameters<typeof ClienteIaHttp>[0]> = {}
) => new ClienteIaHttp({ baseUrl, token: TOKEN, timeoutMs: 2000, ...extra });

describe("ClienteIaHttp: o que sai", () => {
  it("chama as três rotas documentadas, por POST, com JSON e o token de serviço", async () => {
    const s = await servidor((_req, res) => json(res, 200, { ok: true }));
    const c = cliente(s.url);
    await c.abrirSessao({ molde: "supervisor" });
    await c.proximoTurno({ numero: 1 });
    await c.guarda({ texto: "oi" });

    expect(s.pedidos.map((p) => [p.metodo, p.caminho])).toEqual([
      ["POST", "/teste/sessoes"],
      ["POST", "/teste/turnos"],
      ["POST", "/agentes/guarda"]
    ]);
    for (const p of s.pedidos) {
      expect(p.cabecalhos["x-servico-token"]).toBe(TOKEN);
      expect(p.cabecalhos["content-type"]).toBe("application/json");
      expect(p.cabecalhos["accept"]).toBe("application/json");
      expect(p.cabecalhos["authorization"]).toBeUndefined();
    }
    expect(JSON.parse(s.pedidos[0]!.corpo)).toEqual({ molde: "supervisor" });
    expect(JSON.parse(s.pedidos[2]!.corpo)).toEqual({ texto: "oi" });
  });

  it("respeita um prefixo de caminho no endereço, com ou sem barra final", async () => {
    const s = await servidor((_req, res) => json(res, 200, {}));
    await cliente(`${s.url}/ia/v1`).abrirSessao({});
    await cliente(`${s.url}/ia/v1/`).guarda({});
    expect(s.pedidos.map((p) => p.caminho)).toEqual([
      "/ia/v1/teste/sessoes",
      "/ia/v1/agentes/guarda"
    ]);
  });

  it("acrescenta o Authorization (ID token do Cloud Run) quando há um provedor", async () => {
    const s = await servidor((_req, res) => json(res, 200, {}));
    await cliente(s.url, { autorizacao: async () => "id-token-abc" }).abrirSessao({});
    expect(s.pedidos[0]!.cabecalhos["authorization"]).toBe("Bearer id-token-abc");
    expect(s.pedidos[0]!.cabecalhos["x-servico-token"]).toBe(TOKEN);
  });

  it("falha do provedor de credencial vira falha de transporte, sem repassar o motivo", async () => {
    const s = await servidor((_req, res) => json(res, 200, {}));
    const c = cliente(s.url, {
      autorizacao: async () => {
        throw new Error("metadata server em segredo-do-provedor");
      }
    });
    const erro = await c.abrirSessao({}).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeTransporteIa);
    expect((erro as Error).message).not.toContain("segredo-do-provedor");
    expect(s.pedidos).toHaveLength(0);
  });
});

describe("ClienteIaHttp: o que volta", () => {
  it("devolve o JSON cru, sem interpretar", async () => {
    const s = await servidor((_req, res) => json(res, 200, { qualquer: ["coisa", 1, null] }));
    expect(await cliente(s.url).abrirSessao({})).toEqual({ qualquer: ["coisa", 1, null] });
  });

  it.each([400, 401, 404, 422, 500, 502, 503])(
    "HTTP %s é falha de transporte, sem o corpo na mensagem",
    async (status) => {
      const s = await servidor((_req, res) => json(res, status, { detalhe: "SEGREDO-DO-CORPO" }));
      const erro = await cliente(s.url)
        .abrirSessao({})
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroDeTransporteIa);
      expect((erro as Error).message).toBe(`a IA respondeu HTTP ${status}`);
      expect((erro as Error).message).not.toContain("SEGREDO-DO-CORPO");
    }
  );

  it.each([
    ["texto que não é JSON", "isto não é json"],
    ["corpo vazio", ""],
    ["JSON truncado", '{"tipo": "situa']
  ])("200 com %s é falha de transporte", async (_n, corpo) => {
    const s = await servidor((_req, res) => {
      res.writeHead(200);
      res.end(corpo);
    });
    await expect(cliente(s.url).abrirSessao({})).rejects.toBeInstanceOf(ErroDeTransporteIa);
  });

  it("recusa resposta maior que o teto, declarada ou não", async () => {
    const enorme = "x".repeat(LIMITE_DA_RESPOSTA_BYTES + 10);
    const declarada = await servidor((_req, res) => {
      res.writeHead(200, { "Content-Length": String(enorme.length) });
      res.end(enorme);
    });
    const emPartes = await servidor((_req, res) => {
      res.writeHead(200); // sem Content-Length: vai em pedaços
      res.write('"');
      res.write(enorme);
      res.end('"');
    });
    for (const s of [declarada, emPartes]) {
      await expect(cliente(s.url).abrirSessao({})).rejects.toMatchObject({
        name: "ErroDeTransporteIa",
        message: "a resposta da IA é grande demais"
      });
    }
  });
});

describe("ClienteIaHttp: tempo, rede e redirecionamento", () => {
  it("estoura o tempo limite como TimeoutError, preservando o nome", async () => {
    const s = await servidor(() => {
      /* nunca responde */
    });
    const erro = await cliente(s.url, { timeoutMs: 80 })
      .abrirSessao({})
      .catch((e: unknown) => e);
    expect((erro as Error).name).toBe("TimeoutError");
  });

  it("o tempo vale também para a leitura do corpo (resposta que goteja)", async () => {
    const s = await servidor((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write("[");
      // Nunca termina.
    });
    const erro = await cliente(s.url, { timeoutMs: 100 })
      .abrirSessao({})
      .catch((e: unknown) => e);
    expect((erro as Error).name).toBe("TimeoutError");
  });

  it("servidor fora do ar vira falha de transporte", async () => {
    const s = await servidor((_req, res) => json(res, 200, {}));
    const url = s.url;
    await Promise.all(abertos.splice(0).map((x) => new Promise<void>((ok) => x.close(() => ok()))));
    const erro = await cliente(url)
      .abrirSessao({})
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeTransporteIa);
    expect((erro as Error).message).toBe("falha de rede ao chamar a IA");
  });

  it("NÃO segue redirecionamento: o token de serviço não vai para outro endereço", async () => {
    const destino = await servidor((_req, res) => json(res, 200, { chegou: true }));
    const origem = await servidor((_req, res) => {
      res.writeHead(302, { Location: `${destino.url}/roubado` });
      res.end();
    });

    await expect(cliente(origem.url).abrirSessao({})).rejects.toBeInstanceOf(ErroDeTransporteIa);
    expect(origem.pedidos).toHaveLength(1);
    expect(destino.pedidos).toHaveLength(0);
  });
});

describe("ClienteIaHttp: o token não vaza", () => {
  it("não aparece em nenhuma mensagem de erro, em nenhum tipo de falha", async () => {
    const mensagens: string[] = [];
    const ruim = await servidor((_req, res) => json(res, 500, { eco: TOKEN }));
    const mudo = await servidor((_req, res) => {
      res.writeHead(200);
      res.end(`isto não é json ${TOKEN}`);
    });
    const parado = await servidor(() => undefined);
    for (const [url, timeoutMs] of [
      [ruim.url, 2000],
      [mudo.url, 2000],
      [parado.url, 60]
    ] as const) {
      const erro = await cliente(url, { timeoutMs })
        .abrirSessao({})
        .catch((e: unknown) => e);
      mensagens.push(String((erro as Error).message), String(erro));
    }
    expect(mensagens.join(" ")).not.toContain(TOKEN);
  });
});

describe("ClienteIaHttp: configuração", () => {
  it.each([
    ["endereço inválido", { baseUrl: "não é uma url" }],
    ["protocolo que não é http", { baseUrl: "ftp://servidor/ia" }],
    ["credenciais no endereço", { baseUrl: "http://usuario:senha@servidor/ia" }],
    ["token vazio", { token: "  " }],
    ["tempo limite zero", { timeoutMs: 0 }],
    ["tempo limite inválido", { timeoutMs: Number.NaN }]
  ])("recusa %s", (_n, extra) => {
    expect(
      () =>
        new ClienteIaHttp({ baseUrl: "http://servidor", token: TOKEN, timeoutMs: 1000, ...extra })
    ).toThrow();
  });
});

describe("ClienteIaHttp junto com chamarIa (o que o motor usa)", () => {
  it("resposta válida do serviço passa pela validação do contrato", async () => {
    const s = await servidor((_req, res) => json(res, 200, respostaAberturaExemplo()));
    const desfecho = await chamarIa(() => cliente(s.url).abrirSessao({}), validarAberturaIa);
    expect(desfecho).toMatchObject({ ok: true });
  });

  it("classifica as falhas: TIMEOUT, TRANSPORTE e CONTRATO", async () => {
    const lento = await servidor(() => undefined);
    const erro500 = await servidor((_req, res) => json(res, 500, {}));
    const foraDoContrato = await servidor((_req, res) => json(res, 200, { lixo: true }));

    const codigo = async (url: string, timeoutMs = 2000) => {
      const d = await chamarIa(
        () => cliente(url, { timeoutMs }).abrirSessao({}),
        validarAberturaIa
      );
      return d.ok ? "OK" : d.codigo;
    };
    expect(await codigo(lento.url, 60)).toBe("TIMEOUT");
    expect(await codigo(erro500.url)).toBe("TRANSPORTE");
    expect(await codigo(foraDoContrato.url)).toBe("CONTRATO");
  });
});
