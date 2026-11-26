// A conferência de um lote de importação, para a tela "enviar > conferir > confirmar". Quem valida
// é o servidor (import-parser.ts); aqui só se organiza o que ele devolveu. Funções puras.

export type ProblemaDaImportacao = {
  id?: string;
  rowNumber: number | null;
  field: string | null;
  value: string | null;
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
};

export type Conferencia = {
  erros: number;
  avisos: number;
  /** Problemas agrupados por linha da planilha; os sem linha (o arquivo todo) vêm primeiro. */
  porLinha: { linha: number | null; problemas: ProblemaDaImportacao[] }[];
  /** Pode confirmar? Se não, o motivo em linguagem simples. */
  bloqueio: string | null;
};

/** Tamanho seguro do arquivo: o servidor aceita até ~1 MB por envio e o arquivo vai em base64. */
export const LIMITE_DO_ARQUIVO_BYTES = 700 * 1024;

export function conferir(
  tipo: string,
  status: string,
  problemas: readonly ProblemaDaImportacao[]
): Conferencia {
  const erros = problemas.filter((p) => p.severity === "ERROR").length;
  const avisos = problemas.length - erros;
  const grupos = new Map<number | null, ProblemaDaImportacao[]>();
  for (const problema of problemas) {
    const linha = problema.rowNumber ?? null;
    grupos.set(linha, [...(grupos.get(linha) ?? []), problema]);
  }
  const porLinha = [...grupos.entries()]
    .sort(([a], [b]) => (a ?? -1) - (b ?? -1))
    .map(([linha, lista]) => ({
      linha,
      problemas: [...lista].sort((x, y) =>
        x.severity === y.severity ? 0 : x.severity === "ERROR" ? -1 : 1
      )
    }));

  // Espelho das recusas de commit() em import-repository.ts; quem barra de verdade é a API.
  let bloqueio: string | null = null;
  if (status === "COMMITTED") bloqueio = "Este lote já foi importado.";
  else if (erros > 0)
    bloqueio = `Corrija ${erros === 1 ? "o erro" : `os ${erros} erros`} na planilha e envie de novo.`;
  else if (tipo !== "EMPLOYEES")
    bloqueio =
      "Por enquanto só a importação de colaboradores é efetivada; a escala é criada no fluxo próprio.";

  return { erros, avisos, porLinha, bloqueio };
}

/** Lê um arquivo do navegador como base64 (sem o prefixo "data:...;base64,"). */
export function lerComoBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.onload = () => {
      const texto = String(leitor.result ?? "");
      resolve(texto.slice(texto.indexOf(",") + 1));
    };
    leitor.readAsDataURL(arquivo);
  });
}
