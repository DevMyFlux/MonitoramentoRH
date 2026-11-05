// Leadership Lab — o validador de um cenário da biblioteca.
//
// Devolve a lista de problemas (vazia = válido). Os testes rodam este validador sobre TODOS os
// cenários, então um cenário que quebra uma regra não entra: ciclo, beco, nó inalcançável,
// opção sem destino, caminho que não tem cinco decisões, texto fora do limite, parâmetro técnico.
import { labEscolhas, labMoldeNiveis, labSkillsPiloto } from "@my-flux/shared";
import { idsDeFontes } from "./fontes.js";
import {
  CAMADAS_DO_CENARIO,
  type CategoriaDaBiblioteca,
  type CenarioDaBiblioteca,
  type NoDoCenario
} from "./tipos.js";

export const LIMITES_DE_PALAVRAS = {
  situacao: 55,
  marco: 30,
  opcao: 30,
  /** O resumo das camadas 1 e 2 entra no marco ("Até aqui, você ..."), então é curto. */
  resumoInicial: 10,
  resumo: 14,
  consequencia: 35,
  justificativa: 45
} as const;

const skillsConhecidas = new Set<string>(labSkillsPiloto.map((s) => s.id));

export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Parâmetro técnico (pressão, temperatura, vazão, tensão...) ou intervalo de manutenção num texto.
 * O conteúdo é gerencial: números assim só podem vir de uma fonte validada, nunca de um exemplo.
 */
const PADROES_TECNICOS: readonly RegExp[] = [
  /\d\s*(°\s?c|º\s?c|bar|kpa|mpa|psi|mmhg|ppm|kv|kva|kw|hz|rpm|l\/min|m3|m³|mg\/l|µs|us\/cm)/i,
  /a cada \d+\s*(dias?|semanas?|meses|mes|anos?|horas?)/i,
  /\b\d+\s*(dias|semanas|meses|anos)\s+(de intervalo|entre)/i
];

export function achaParametroTecnico(texto: string): boolean {
  return PADROES_TECNICOS.some((p) => p.test(texto));
}

export function validarCenario(cenario: CenarioDaBiblioteca): string[] {
  const p: string[] = [];
  const ids = new Set<string>();
  for (const no of cenario.nos) {
    if (ids.has(no.id)) p.push(`nó duplicado: ${no.id}`);
    ids.add(no.id);
  }
  const porId = new Map<string, NoDoCenario>(cenario.nos.map((n) => [n.id, n]));

  if (cenario.id !== cenario.categoriaId) p.push("o id do cenário deve ser o da categoria");
  if (cenario.niveis.length === 0) p.push("nenhum cargo compatível");
  for (const nivel of labMoldeNiveis) {
    const abertura = cenario.aberturas[nivel];
    if (abertura.trim() === "") p.push(`abertura vazia para ${nivel}`);
    texto(p, `abertura (${nivel})`, abertura, LIMITES_DE_PALAVRAS.situacao);
  }
  if (cenario.fontes.length === 0) p.push("sem fonte de referência");
  for (const fonte of cenario.fontes) {
    if (!idsDeFontes.has(fonte)) p.push(`fonte desconhecida: ${fonte}`);
  }

  const inicio = porId.get(cenario.inicio);
  if (!inicio) {
    p.push(`nó inicial inexistente: ${cenario.inicio}`);
    return p;
  }
  if (inicio.camada !== 1) p.push("o nó inicial deve estar na camada 1");
  if (cenario.nos.filter((n) => n.camada === 1).length !== 1) {
    p.push("a camada 1 deve ter exatamente um nó");
  }

  const melhores = new Set<string>();
  for (const no of cenario.nos) {
    const onde = `nó ${no.id}`;
    if (!Number.isInteger(no.camada) || no.camada < 1 || no.camada > CAMADAS_DO_CENARIO) {
      p.push(`${onde}: camada fora de 1..${CAMADAS_DO_CENARIO}`);
      continue;
    }
    const ehMarco = no.camada === 3;
    if (no.camada > 1) {
      texto(
        p,
        `${onde} contexto`,
        no.contexto,
        ehMarco ? LIMITES_DE_PALAVRAS.marco : LIMITES_DE_PALAVRAS.situacao
      );
    } else if (no.contexto.trim() === "") {
      p.push(`${onde}: contexto vazio`);
    }
    if (no.skillsEmJogo.length === 0) p.push(`${onde}: sem skills em jogo`);
    for (const s of no.skillsEmJogo)
      if (!skillsConhecidas.has(s)) p.push(`${onde}: skill desconhecida ${s}`);

    const letras = Object.keys(no.opcoes).sort().join("");
    if (letras !== [...labEscolhas].sort().join(""))
      p.push(`${onde}: devem existir exatamente as opções A, B e C`);

    const ultima = no.camada === CAMADAS_DO_CENARIO;
    const destinos: Array<[string, string | null]> = [
      ...labEscolhas.map((e): [string, string | null] => [
        `opção ${e}`,
        no.opcoes[e]?.proximo ?? null
      ]),
      ["aoOmitir", no.aoOmitir]
    ];
    for (const [rotulo, destino] of destinos) {
      if (ultima) {
        if (destino !== null) p.push(`${onde} ${rotulo}: a última camada não tem destino`);
        continue;
      }
      if (destino === null) {
        p.push(`${onde} ${rotulo}: sem destino (beco)`);
        continue;
      }
      const alvo = porId.get(destino);
      if (!alvo) p.push(`${onde} ${rotulo}: destino inexistente ${destino}`);
      else if (alvo.camada !== no.camada + 1) {
        p.push(`${onde} ${rotulo}: destino ${destino} deve estar na camada ${no.camada + 1}`);
      }
    }

    for (const e of labEscolhas) {
      const o = no.opcoes[e];
      if (!o) continue;
      const donde = `${onde} opção ${e}`;
      texto(p, `${donde} texto`, o.texto, LIMITES_DE_PALAVRAS.opcao);
      texto(
        p,
        `${donde} resumo`,
        o.resumo,
        no.camada <= 2 ? LIMITES_DE_PALAVRAS.resumoInicial : LIMITES_DE_PALAVRAS.resumo
      );
      texto(p, `${donde} consequência`, o.consequencia, LIMITES_DE_PALAVRAS.consequencia);
      texto(p, `${donde} justificativa`, o.justificativa, LIMITES_DE_PALAVRAS.justificativa);
      if (o.skills.length === 0) p.push(`${donde}: sem skills`);
      if (new Set(o.skills).size !== o.skills.length) p.push(`${donde}: skills repetidas`);
      for (const s of o.skills)
        if (!skillsConhecidas.has(s)) p.push(`${donde}: skill desconhecida ${s}`);
      if ((o.aderencia === 10) !== (o.linhaVermelha === true)) {
        p.push(`${donde}: aderência 10 e linha vermelha andam juntas`);
      }
      // Coerência com o estilo: a resposta de 100 que envolve a equipe tem o estilo que a situação
      // pede, e o estilo que a situação pede nunca fica abaixo de 70.
      if (o.aderencia === 100 && o.estilo !== null && o.estilo !== no.estiloAdequado) {
        p.push(`${donde}: aderência 100 com estilo diferente do adequado`);
      }
      if (o.estilo !== null && o.estilo === no.estiloAdequado && o.aderencia < 70) {
        p.push(`${donde}: o estilo adequado não pode ter aderência abaixo de 70`);
      }
      if (o.aderencia === 100) melhores.add(e);
    }
    if (!labEscolhas.some((e) => no.opcoes[e]?.aderencia === 100)) {
      p.push(`${onde}: nenhuma opção de aderência 100`);
    }
    if (new Set(labEscolhas.map((e) => no.opcoes[e]?.aderencia)).size < 2) {
      p.push(`${onde}: as opções devem ter aderências diferentes`);
    }
  }
  // A melhor resposta não pode estar sempre na mesma letra: o participante aprenderia a letra.
  if (melhores.size < 2) p.push("a opção de aderência 100 está sempre na mesma letra");

  // Alcançabilidade e ciclos, a partir do início. As camadas crescem de um em um, então não há ciclo
  // se os destinos já foram conferidos; o percurso abaixo confirma por busca.
  const alcancados = new Set<string>();
  const fila: string[] = [cenario.inicio];
  while (fila.length > 0) {
    const id = fila.shift();
    if (id === undefined || alcancados.has(id)) continue;
    alcancados.add(id);
    const no = porId.get(id);
    if (!no) continue;
    for (const destino of [...labEscolhas.map((e) => no.opcoes[e]?.proximo ?? null), no.aoOmitir]) {
      if (destino !== null) fila.push(destino);
    }
  }
  for (const no of cenario.nos) if (!alcancados.has(no.id)) p.push(`nó inalcançável: ${no.id}`);

  // Todo caminho tem exatamente cinco decisões e termina na última camada.
  const camadasPorId = new Map<string, number>(cenario.nos.map((n) => [n.id, n.camada]));
  const visitando = new Set<string>();
  const verificar = (id: string, profundidade: number): void => {
    const no = porId.get(id);
    if (!no) return;
    if (visitando.has(id)) {
      p.push(`ciclo em ${id}`);
      return;
    }
    if (camadasPorId.get(id) !== profundidade)
      p.push(`nó ${id} fora da camada esperada ${profundidade}`);
    if (profundidade === CAMADAS_DO_CENARIO) return;
    visitando.add(id);
    for (const destino of [...labEscolhas.map((e) => no.opcoes[e]?.proximo ?? null), no.aoOmitir]) {
      if (destino !== null) verificar(destino, profundidade + 1);
    }
    visitando.delete(id);
  };
  verificar(cenario.inicio, 1);

  return [...new Set(p)];
}

function texto(problemas: string[], onde: string, valor: string, maximo: number): void {
  if (valor.trim() === "") {
    problemas.push(`${onde}: vazio`);
    return;
  }
  const palavras = contarPalavras(valor);
  if (palavras > maximo) problemas.push(`${onde}: ${palavras} palavras (máximo ${maximo})`);
  if (achaParametroTecnico(valor)) problemas.push(`${onde}: parece trazer parâmetro técnico`);
}

export function validarCategoria(categoria: CategoriaDaBiblioteca): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(categoria.id)) p.push("id inválido");
  if (categoria.nome.trim() === "") p.push("nome vazio");
  if (categoria.descricao.trim() === "") p.push("descrição vazia");
  if (categoria.palavrasFortes.length < 3) p.push("poucas palavras fortes (mínimo 3)");
  if (categoria.exemplos.length < 2) p.push("poucos exemplos (mínimo 2)");
  return p;
}
