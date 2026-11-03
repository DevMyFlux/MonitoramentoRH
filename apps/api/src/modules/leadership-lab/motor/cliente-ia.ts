// Leadership Lab — a fronteira com o serviço de IA.
//
// O motor só conhece esta interface. O cliente HTTP real (token de serviço, ID token do Cloud
// Run, timeout) é uma implementação dela; os testes usam a IA falsa. Os métodos devolvem o
// corpo CRU da resposta: quem valida é sempre o motor (ia-contrato), então nenhuma
// implementação consegue contornar o contrato. Falha de rede, tempo esgotado ou status de erro
// devem LANÇAR; o motor trata qualquer exceção como falha de transporte.
import type {
  GuardaIaRequest,
  IniciarSessaoIaRequest,
  ProximoTurnoIaRequest,
  ResultadoDaValidacao
} from "../ia/ia-contrato.js";

export interface ClienteIa {
  /** POST /teste/sessoes */
  abrirSessao(corpo: IniciarSessaoIaRequest): Promise<unknown>;
  /** POST /teste/turnos */
  proximoTurno(corpo: ProximoTurnoIaRequest): Promise<unknown>;
  /** POST /agentes/guarda */
  guarda(corpo: GuardaIaRequest): Promise<unknown>;
}

/** Falha ao falar com o serviço (rede, status de erro, resposta que não é JSON). */
export class ErroDeTransporteIa extends Error {
  constructor(
    message: string,
    readonly causa?: unknown
  ) {
    super(message);
    this.name = "ErroDeTransporteIa";
  }
}

/** Por que uma chamada falhou. Vai para log_ia.codigo_erro. */
export type CodigoDeFalhaIa = "TRANSPORTE" | "TIMEOUT" | "CONTRATO";

export type DesfechoDaChamada<T> =
  | { ok: true; valor: T; avisos: string[]; latenciaMs: number }
  | { ok: false; codigo: CodigoDeFalhaIa; problemas: string[]; latenciaMs: number };

function foiTimeout(erro: unknown): boolean {
  return erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError");
}

/**
 * Executa uma chamada, mede a latência e valida a resposta. Nunca lança por falha da IA:
 * devolve o desfecho para o motor decidir o que gravar e o que responder.
 */
export async function chamarIa<T>(
  executar: () => Promise<unknown>,
  validar: (bruto: unknown) => ResultadoDaValidacao<T>
): Promise<DesfechoDaChamada<T>> {
  const inicio = performance.now();
  const latencia = () => Math.round(performance.now() - inicio);

  let bruto: unknown;
  try {
    bruto = await executar();
  } catch (erro) {
    return {
      ok: false,
      codigo: foiTimeout(erro) ? "TIMEOUT" : "TRANSPORTE",
      problemas: [erro instanceof Error ? erro.message : "falha desconhecida ao chamar a IA"],
      latenciaMs: latencia()
    };
  }

  const validacao = validar(bruto);
  return validacao.ok
    ? { ok: true, valor: validacao.valor, avisos: validacao.avisos, latenciaMs: latencia() }
    : { ok: false, codigo: "CONTRATO", problemas: validacao.problemas, latenciaMs: latencia() };
}
