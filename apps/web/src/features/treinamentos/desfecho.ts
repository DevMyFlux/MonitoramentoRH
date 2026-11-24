// O estado final da cena no desfecho: as reações das respostas, na ordem, e depois as cenas dos
// acontecimentos que ocorreram (na ordem em que o motor os avaliou). Função pura.
import type { ResultadoDaTentativa } from "./api";
import { aplicarCena, type EstadoDaCena } from "./fluxo";

/** A cena final: o estado das reações, mais as cenas dos acontecimentos que ocorreram, em ordem. */
export function cenaDoDesfecho(
  resultado: ResultadoDaTentativa,
  inicial: EstadoDaCena
): EstadoDaCena {
  const porReacao = resultado.respostas.reduce<EstadoDaCena>(
    (estado, r) => aplicarCena(estado, r.reacao.scene),
    inicial
  );
  const cenas = new Map(resultado.regras.events.map((e) => [e.id, e.scene]));
  return resultado.desfecho.events
    .filter((e) => e.aconteceu)
    .reduce<EstadoDaCena>((estado, e) => aplicarCena(estado, cenas.get(e.id) ?? {}), porReacao);
}
