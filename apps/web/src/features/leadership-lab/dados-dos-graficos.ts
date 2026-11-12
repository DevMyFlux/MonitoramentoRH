// Leadership Lab — os dados dos gráficos, separados do desenho para poderem ser testados sem o
// Recharts. Cada gráfico tem também uma versão em texto (lista ou tabela) para leitor de tela.
import type { LabPontoDaEvolucao, LabSkillDoPainel } from "@my-flux/shared";
import { formatarDataCurta, formatarNumero } from "./rotulos";

/**
 * Quebra um rótulo em linhas de até `maximo` caracteres, só entre palavras. Os nomes das skills são
 * longos ("Delegação e desenvolvimento do time") e, numa linha só, o radar os corta nas bordas.
 */
export function quebrarEmLinhas(texto: string, maximo: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    if (atual !== "" && `${atual} ${palavra}`.length > maximo) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = atual === "" ? palavra : `${atual} ${palavra}`;
    }
  }
  if (atual !== "") linhas.push(atual);
  return linhas;
}

export type PontoDoRadar = { skill: string; nivel: number };

/** Uma skill sem evidência fica no centro do radar (nível 0); a lista ao lado diz "sem evidência". */
export function dadosDoRadar(skills: readonly LabSkillDoPainel[]): PontoDoRadar[] {
  return skills.map((s) => ({ skill: s.nome, nivel: s.nivel ?? 0 }));
}

export function descricaoDoRadar(skills: readonly LabSkillDoPainel[]): string {
  return skills
    .map((s) => `${s.nome}: ${s.nivel === null ? "sem evidência" : `nível ${s.nivel} de 5`}`)
    .join("; ");
}

export type PontoDaLinha = {
  rotulo: string;
  data: string;
  aderencia: number;
  agilidade: number;
  aguardandoValidacao: boolean;
};

export function dadosDaEvolucao(pontos: readonly LabPontoDaEvolucao[]): PontoDaLinha[] {
  return pontos.map((p, i) => ({
    rotulo: `Teste ${i + 1}`,
    data: formatarDataCurta(p.concluidaEm),
    aderencia: p.aderenciaGeral,
    agilidade: p.agilidade,
    aguardandoValidacao: p.statusValidacao === "aguardando_validacao"
  }));
}

export function descricaoDaEvolucao(pontos: readonly LabPontoDaEvolucao[]): string {
  return dadosDaEvolucao(pontos)
    .map((p) => `${p.rotulo} (${p.data}): aderência ${p.aderencia}, agilidade ${p.agilidade}`)
    .join("; ");
}

/**
 * A linha de detalhe do cartão "Último teste": a aderência dele e, quando o servidor já libera a
 * tendência (a regra dos testes mínimos é dele), quanto mudou em relação ao teste anterior.
 */
export function resumoDoUltimoTeste(
  pontos: readonly LabPontoDaEvolucao[],
  tendenciaDisponivel: boolean
): string | null {
  const ultimo = pontos.at(-1);
  if (!ultimo) return null;
  const base = `Aderência de ${formatarNumero(ultimo.aderenciaGeral)}%`;
  const anterior = pontos.at(-2);
  if (!tendenciaDisponivel || !anterior) return base;
  const diferenca = Math.round((ultimo.aderenciaGeral - anterior.aderenciaGeral) * 10) / 10;
  if (diferenca === 0) return `${base}, igual ao teste anterior`;
  const pontosDeDiferenca = `${formatarNumero(Math.abs(diferenca))} ${Math.abs(diferenca) === 1 ? "ponto" : "pontos"}`;
  return `${base}, ${pontosDeDiferenca} ${diferenca > 0 ? "acima" : "abaixo"} do teste anterior`;
}
