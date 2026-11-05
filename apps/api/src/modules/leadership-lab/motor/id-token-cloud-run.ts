// Leadership Lab — ID token do Google para chamar o serviço de IA no Cloud Run SEM acesso público.
//
// Com LAB_IA_AUTENTICACAO=cloud-run, o cliente HTTP manda `Authorization: Bearer <ID token>`, e só
// contas com o papel Invocador do Cloud Run no serviço de IA conseguem chamá-lo. O token vem do
// servidor de metadados do próprio Cloud Run (a conta de serviço do site), sem chave nem arquivo.
//
// Cuidados:
//  - O público (audience) é a ORIGEM do serviço de IA, como o Cloud Run exige.
//  - Cache até 5 minutos antes de expirar: uma chamada por hora ao metadados, não uma por turno.
//  - Erro do metadados lança; o cliente HTTP transforma em falha de transporte.

const METADADOS =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

/** Renova antes de expirar, para um token não vencer no meio da chamada. */
const MARGEM_MS = 5 * 60_000;

/** Validade presumida quando o token não diz quando expira. */
const VALIDADE_PADRAO_MS = 50 * 60_000;

export type OpcoesIdToken = {
  /** Para testes. */
  fetchImpl?: typeof fetch;
  /** Para testes. */
  agora?: () => number;
};

/** Lê o `exp` (segundos) do payload do JWT, sem verificar a assinatura: só para o cache. */
function expiraEm(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const exp = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Devolve a função `autorizacao` do ClienteIaHttp para o serviço em `urlDoServico`. */
export function criarIdTokenDoCloudRun(
  urlDoServico: string,
  opcoes: OpcoesIdToken = {}
): () => Promise<string> {
  const audiencia = new URL(urlDoServico).origin;
  const buscar = opcoes.fetchImpl ?? fetch;
  const agora = opcoes.agora ?? Date.now;
  let guardado: { token: string; renovarEm: number } | null = null;

  return async () => {
    if (guardado && agora() < guardado.renovarEm) return guardado.token;

    const url = `${METADADOS}?audience=${encodeURIComponent(audiencia)}`;
    const resposta = await buscar(url, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(5_000)
    });
    if (!resposta.ok) throw new Error(`metadados do Cloud Run responderam HTTP ${resposta.status}`);
    const token = (await resposta.text()).trim();
    if (!token) throw new Error("metadados do Cloud Run devolveram um token vazio");

    const expira = expiraEm(token) ?? agora() + VALIDADE_PADRAO_MS;
    guardado = { token, renovarEm: expira - MARGEM_MS };
    return token;
  };
}
