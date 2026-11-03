// Leadership Lab — cliente HTTP do serviço de IA (Python, Google ADK).
//
// Fala só com as rotas documentadas do serviço: POST /teste/sessoes, POST /teste/turnos e
// POST /agentes/guarda, com o token de serviço em X-Servico-Token. Devolve o corpo CRU em JSON;
// quem valida o contrato é o motor. Qualquer falha LANÇA (o motor a trata como falha de
// transporte), e o nome do erro de tempo esgotado é preservado ("TimeoutError") para o log.
//
// Cuidados:
//  - Não segue redirecionamento: o token de serviço nunca vai para um endereço que o
//    operador não configurou.
//  - O tempo limite vale para a chamada inteira, inclusive a leitura do corpo.
//  - O tamanho da resposta é limitado; uma resposta gigante não derruba o servidor.
//  - Mensagens de erro não carregam o corpo da resposta, a URL com credenciais nem o token.
//  - Se o serviço estiver no Cloud Run sem acesso público, `autorizacao` fornece o ID token
//    (cabeçalho Authorization). Fica como gancho porque onde o RH roda ainda está em aberto.
import { type ClienteIa, ErroDeTransporteIa } from "./cliente-ia.js";

/** Teto da resposta da IA. Um turno completo tem poucos KB. */
export const LIMITE_DA_RESPOSTA_BYTES = 1_000_000;

export type OpcoesClienteIaHttp = {
  /** Endereço do serviço. Pode ter prefixo de caminho (https://host/ia). Sem credenciais. */
  baseUrl: string;
  /** Segredo compartilhado, enviado em X-Servico-Token. */
  token: string;
  timeoutMs: number;
  /** ID token (ou outro bearer) para o Authorization, quando o serviço exige IAM. */
  autorizacao?: () => Promise<string>;
  /** Para testes. */
  fetchImpl?: typeof fetch;
};

async function lerTextoLimitado(resposta: Response, limite: number): Promise<string> {
  const declarado = Number(resposta.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > limite) {
    await resposta.body?.cancel();
    throw new ErroDeTransporteIa("a resposta da IA é grande demais");
  }
  const leitor = resposta.body?.getReader();
  if (!leitor) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel();
      throw new ErroDeTransporteIa("a resposta da IA é grande demais");
    }
    partes.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(partes));
}

function eTimeout(erro: unknown): boolean {
  return erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError");
}

export class ClienteIaHttp implements ClienteIa {
  private readonly base: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly autorizacao: (() => Promise<string>) | undefined;
  private readonly buscar: typeof fetch;

  constructor(opcoes: OpcoesClienteIaHttp) {
    let url: URL;
    try {
      url = new URL(opcoes.baseUrl);
    } catch {
      throw new Error("Endereço do serviço de IA inválido.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("O endereço do serviço de IA deve ser http ou https.");
    }
    if (url.username !== "" || url.password !== "") {
      throw new Error("O endereço do serviço de IA não pode conter credenciais.");
    }
    if (opcoes.token.trim() === "") throw new Error("O token do serviço de IA é obrigatório.");
    if (!Number.isFinite(opcoes.timeoutMs) || opcoes.timeoutMs <= 0) {
      throw new Error("O tempo limite do serviço de IA deve ser positivo.");
    }

    url.search = "";
    url.hash = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    this.base = url.toString();
    this.token = opcoes.token;
    this.timeoutMs = opcoes.timeoutMs;
    this.autorizacao = opcoes.autorizacao;
    this.buscar = opcoes.fetchImpl ?? fetch;
  }

  abrirSessao(corpo: unknown): Promise<unknown> {
    return this.postar("teste/sessoes", corpo);
  }

  proximoTurno(corpo: unknown): Promise<unknown> {
    return this.postar("teste/turnos", corpo);
  }

  guarda(corpo: unknown): Promise<unknown> {
    return this.postar("agentes/guarda", corpo);
  }

  private async postar(caminho: string, corpo: unknown): Promise<unknown> {
    const cabecalhos: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Servico-Token": this.token
    };
    if (this.autorizacao) {
      try {
        cabecalhos.Authorization = `Bearer ${await this.autorizacao()}`;
      } catch {
        throw new ErroDeTransporteIa("não foi possível obter a credencial para chamar a IA");
      }
    }

    let resposta: Response;
    try {
      resposta = await this.buscar(new URL(caminho, this.base), {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error"
      });
    } catch (erro) {
      if (eTimeout(erro)) throw erro;
      throw new ErroDeTransporteIa("falha de rede ao chamar a IA", erro);
    }

    if (!resposta.ok) {
      await resposta.body?.cancel().catch(() => undefined);
      throw new ErroDeTransporteIa(`a IA respondeu HTTP ${resposta.status}`);
    }

    let texto: string;
    try {
      texto = await lerTextoLimitado(resposta, LIMITE_DA_RESPOSTA_BYTES);
    } catch (erro) {
      if (erro instanceof ErroDeTransporteIa || eTimeout(erro)) throw erro;
      throw new ErroDeTransporteIa("falha ao ler a resposta da IA", erro);
    }
    try {
      return JSON.parse(texto) as unknown;
    } catch {
      throw new ErroDeTransporteIa("a IA respondeu algo que não é JSON");
    }
  }
}
