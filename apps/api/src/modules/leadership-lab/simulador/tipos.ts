// Leadership Lab — os tipos da biblioteca de simulações locais.
//
// Cada tema (categoria) tem UM cenário: um grafo de situações com cinco camadas de decisão. A
// camada 1 tem um nó só; as camadas 2 a 5 têm dois nós cada, "a" (a situação segue sob controle) e
// "b" (a situação se agravou). Toda opção aponta para um nó da camada seguinte, então qualquer
// caminho tem exatamente cinco decisões, sem ciclo e sem beco, e os caminhos convergem (nove nós em
// vez de 243 folhas). A terceira camada é o marco: o texto recorda o que o participante já fez.
//
// TUDO O QUE AVALIA (aderência, estilo, skills, linha vermelha, justificativa) mora aqui, só no
// servidor. O front recebe apenas o texto da situação, as três opções e a consequência.
//
// CONTEÚDO DEMONSTRATIVO: as situações são originais e de nível gerencial (priorizar risco,
// comunicar, seguir procedimento, usar recursos, decidir sob pressão). Não trazem intervalo de
// manutenção, pressão, temperatura nem procedimento de intervenção: isso é da norma brasileira,
// do procedimento do Grand Massif e do fabricante, que sempre prevalecem. As fontes citadas são
// referência temática, não texto reproduzido.
import type {
  LabEscolha,
  LabEstilo,
  LabMoldeNivel,
  LabPersonagem,
  LabSkillId
} from "@my-flux/shared";

export const CAMADAS_DO_CENARIO = 5;

export type CamadaDoCenario = 1 | 2 | 3 | 4 | 5;

export type OpcaoDoCenario = {
  /** O que o participante lê. Até 30 palavras. */
  texto: string;
  /** A escolha no passado ("alinhou com a responsável assistencial"): alimenta o marco e o fechamento. */
  resumo: string;
  /** Nulo quando a escolha não envolve a equipe. */
  estilo: LabEstilo | null;
  aderencia: 100 | 70 | 40 | 10;
  /** Aderência 10 e linha vermelha andam juntas: gera o alerta vermelho para o curador. */
  linhaVermelha?: true;
  skills: readonly LabSkillId[];
  /** Só aparece no resultado, nunca durante o teste. */
  justificativa: string;
  /** O efeito da escolha, mostrado antes da próxima situação. */
  consequencia: string;
  /** Nó da camada seguinte; nulo só na camada 5. */
  proximo: string | null;
};

export type NoDoCenario = {
  id: string;
  camada: CamadaDoCenario;
  personagem: LabPersonagem;
  /** A situação, até 55 palavras (35 no marco, que ganha uma frase de recordação). */
  contexto: string;
  estiloAdequado: LabEstilo;
  /** Skills em jogo: uma omissão (tempo esgotado) conta zero nelas. */
  skillsEmJogo: readonly LabSkillId[];
  opcoes: Record<LabEscolha, OpcaoDoCenario>;
  /** Nó seguinte quando o tempo esgota; nulo só na camada 5. */
  aoOmitir: string | null;
  /** O efeito de ninguém decidir. Vazio usa o texto padrão. */
  consequenciaOmissao?: string;
};

export type FonteDeReferencia = {
  id: string;
  /** Como a fonte é citada na documentação. */
  nome: string;
  /** Sempre "referência temática": o texto não foi reproduzido nem consultado nesta versão. */
  uso: "referencia-tematica";
};

export type CategoriaDaBiblioteca = {
  id: string;
  nome: string;
  descricao: string;
  /** Palavras que identificam o tema sozinhas (peso 3). */
  palavrasFortes: readonly string[];
  /** Palavras que só ajudam (peso 1). */
  palavrasFracas: readonly string[];
  exemplos: readonly string[];
};

export type CenarioDaBiblioteca = {
  /** Igual ao id da categoria: um cenário por tema. */
  id: string;
  categoriaId: string;
  versao: string;
  titulo: string;
  /** Cargos para os quais o cenário vale. */
  niveis: readonly LabMoldeNivel[];
  /** A situação 1 muda conforme o cargo; as demais são comuns. Até 55 palavras cada. */
  aberturas: Readonly<Record<LabMoldeNivel, string>>;
  inicio: string;
  nos: readonly NoDoCenario[];
  fontes: readonly string[];
};

/** O que cada arquivo de tema exporta. */
export type PacoteDaCategoria = {
  categoria: CategoriaDaBiblioteca;
  cenario: CenarioDaBiblioteca;
};
