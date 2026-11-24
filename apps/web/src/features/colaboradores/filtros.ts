// Filtros da lista de Colaboradores: unidade, busca livre, desligados, turno, situação e rodízio.
// Função pura: a página passa como descobrir o rodízio de cada pessoa (Par/Ímpar efetivo no mês ou
// 5x2), que depende das regras de escala que já moram lá. Só filtra o que a API já devolveu.
export type Rodizio = "PAR" | "IMPAR" | "5X2" | "NENHUM";

export type FiltrosDeColaboradores = {
  operationId: string;
  busca: string;
  mostrarDesligados: boolean;
  /** Código do turno ("DIURNO"...); vazio = todos. */
  turno: string;
  /** Situação funcional ("ACTIVE"...); vazio = todas. */
  situacao: string;
  /** Vazio = todos. */
  rodizio: Rodizio | "";
};

type Pessoa = { operationId?: unknown; status?: unknown; shift?: unknown };

const comoTexto = (valor: unknown) => (typeof valor === "string" ? valor : "");

export function filtrarColaboradores<T extends object>(
  pessoas: readonly T[],
  filtros: FiltrosDeColaboradores,
  rodizioDe: (pessoa: T) => Rodizio
): T[] {
  const busca = filtros.busca.trim().toLowerCase();
  return pessoas.filter((item) => {
    const pessoa = item as Pessoa;
    const status = comoTexto(pessoa.status);
    if (pessoa.operationId !== filtros.operationId) return false;
    // Pedir "Desligado" na situação mostra os desligados mesmo com o interruptor apagado.
    if (!filtros.mostrarDesligados && status === "TERMINATED" && filtros.situacao !== "TERMINATED")
      return false;
    if (filtros.situacao && status !== filtros.situacao) return false;
    if (filtros.turno && comoTexto(pessoa.shift) !== filtros.turno) return false;
    if (filtros.rodizio && rodizioDe(item) !== filtros.rodizio) return false;
    return !busca || JSON.stringify(pessoa).toLowerCase().includes(busca);
  });
}

/** Quantos filtros além da unidade estão ligados (para o botão "Limpar filtros"). */
export function filtrosAtivos(filtros: FiltrosDeColaboradores): number {
  return [filtros.busca.trim(), filtros.turno, filtros.situacao, filtros.rodizio].filter(Boolean)
    .length;
}
