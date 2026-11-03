// Leadership Lab — o serviço de IA falso, por HTTP. SÓ para testes.
//
// Põe uma IaFalsa atrás de um servidor HTTP de verdade (porta efêmera, só localhost), com as
// três rotas documentadas e a checagem do X-Servico-Token. Serve para exercitar o cliente
// HTTP e a cadeia completa (rotas -> motor -> cliente HTTP -> serviço) sem o serviço Python.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** O que o serviço precisa de uma IA: corpos crus em JSON (quem valida é o motor, não o serviço). */
export type IaPorHttp = {
  abrirSessao(corpo: unknown): Promise<unknown>;
  proximoTurno(corpo: unknown): Promise<unknown>;
  guarda(corpo: unknown): Promise<unknown>;
};

export type RequisicaoRecebida = {
  metodo: string;
  caminho: string;
  cabecalhos: Record<string, string | string[] | undefined>;
  corpo: unknown;
};

export type ServicoIaFalso = {
  url: string;
  requisicoes: RequisicaoRecebida[];
  fechar(): Promise<void>;
};

export async function subirServicoIaFalso(ia: IaPorHttp, token: string): Promise<ServicoIaFalso> {
  const requisicoes: RequisicaoRecebida[] = [];

  const servidor = createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on("data", (parte: Buffer) => partes.push(parte));
    req.on("end", () => {
      void (async () => {
        const texto = Buffer.concat(partes).toString("utf8");
        let corpo: unknown;
        try {
          corpo = texto === "" ? undefined : JSON.parse(texto);
        } catch {
          corpo = texto;
        }
        const caminho = req.url ?? "";
        requisicoes.push({ metodo: req.method ?? "", caminho, cabecalhos: req.headers, corpo });

        const responder = (status: number, conteudo: unknown) => {
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(conteudo));
        };

        if (req.method !== "POST") return responder(405, { erro: "método não permitido" });
        if (req.headers["x-servico-token"] !== token)
          return responder(401, { erro: "token inválido" });

        try {
          if (caminho === "/teste/sessoes") return responder(200, await ia.abrirSessao(corpo));
          if (caminho === "/teste/turnos") return responder(200, await ia.proximoTurno(corpo));
          if (caminho === "/agentes/guarda") return responder(200, await ia.guarda(corpo));
          return responder(404, { erro: "rota desconhecida" });
        } catch {
          return responder(503, { erro: "serviço indisponível" });
        }
      })();
    });
  });

  await new Promise<void>((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const { port } = servidor.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requisicoes,
    fechar: () =>
      new Promise<void>((resolver, rejeitar) => {
        servidor.closeAllConnections();
        servidor.close((erro) => (erro ? rejeitar(erro) : resolver()));
      })
  };
}
