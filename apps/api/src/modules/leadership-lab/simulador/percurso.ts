// Leadership Lab — percorrer o grafo de um cenário.
//
// Puro. A IA de demonstração não guarda estado: a cada turno ela recebe do banco as escolhas já
// feitas e refaz o caminho a partir do nó inicial. Escolher segue o `proximo` da opção; deixar o
// tempo esgotar segue o `aoOmitir` do nó.
import type { LabEscolha } from "@my-flux/shared";
import type { CenarioDaBiblioteca, NoDoCenario } from "./tipos.js";

export type PassoDoPercurso = { numero: number; escolha: LabEscolha | null };

export function noDoCenario(cenario: CenarioDaBiblioteca, id: string): NoDoCenario {
  const no = cenario.nos.find((n) => n.id === id);
  if (!no) throw new Error(`Cenário ${cenario.id}: nó "${id}" não existe.`);
  return no;
}

/** O nó seguinte a `no` dada a escolha (nula = tempo esgotado). Nulo depois da última decisão. */
export function proximoNo(
  cenario: CenarioDaBiblioteca,
  no: NoDoCenario,
  escolha: LabEscolha | null
): NoDoCenario | null {
  const id = escolha === null ? no.aoOmitir : no.opcoes[escolha].proximo;
  return id === null ? null : noDoCenario(cenario, id);
}

/**
 * Os nós das situações 1..`ate`, na ordem. `passos` traz as escolhas das situações anteriores a
 * `ate` (a de `ate` não é necessária para saber QUAL é o nó).
 */
export function nosDoPercurso(
  cenario: CenarioDaBiblioteca,
  passos: readonly PassoDoPercurso[],
  ate: number
): NoDoCenario[] {
  const nos: NoDoCenario[] = [noDoCenario(cenario, cenario.inicio)];
  for (let numero = 1; numero < ate; numero += 1) {
    const passo = passos.find((p) => p.numero === numero);
    if (!passo) throw new Error(`Percurso incompleto: falta a escolha da situação ${numero}.`);
    const anterior = nos[nos.length - 1];
    if (!anterior) throw new Error("Percurso vazio.");
    const seguinte = proximoNo(cenario, anterior, passo.escolha);
    if (!seguinte) throw new Error(`Percurso terminou antes da situação ${ate}.`);
    nos.push(seguinte);
  }
  return nos;
}
