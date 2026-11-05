// Leadership Lab — atalhos para escrever um cenário sem repetir a estrutura do grafo.
//
// A forma do grafo é a mesma em todos os cenários (veja tipos.ts): a camada 1 tem o nó "n1"; as
// camadas 2 a 5 têm "nXa" (sob controle) e "nXb" (agravada). O destino de cada opção é mecânico:
// aderência 70 ou 100 leva ao "a" da camada seguinte; 40 ou 10, ao "b"; o tempo esgotado também
// leva ao "b". O validador confere o resultado, então nenhum atalho escapa das regras.
import type { LabEstilo, LabPersonagem, LabSkillId } from "@my-flux/shared";
import type {
  CamadaDoCenario,
  CategoriaDaBiblioteca,
  CenarioDaBiblioteca,
  NoDoCenario,
  OpcaoDoCenario,
  PacoteDaCategoria
} from "./tipos.js";

type Skills = readonly LabSkillId[];

export type OpcaoEscrita = Omit<OpcaoDoCenario, "proximo">;

/** Uma opção. A ordem dos argumentos é a ordem em que se lê: o que diz, o que fez, e por quê. */
export function opcao(
  texto: string,
  resumo: string,
  estilo: LabEstilo | null,
  aderencia: 100 | 70 | 40 | 10,
  skills: Skills,
  justificativa: string,
  consequencia: string
): OpcaoEscrita {
  return {
    texto,
    resumo,
    estilo,
    aderencia,
    ...(aderencia === 10 ? { linhaVermelha: true as const } : {}),
    skills,
    justificativa,
    consequencia
  };
}

export type IdDeNo = "n1" | "n2a" | "n2b" | "n3a" | "n3b" | "n4a" | "n4b" | "n5a" | "n5b";

function camadaDe(id: IdDeNo): CamadaDoCenario {
  return Number(id[1]) as CamadaDoCenario;
}

function destinoDe(id: IdDeNo, aderencia: number): string | null {
  const camada = camadaDe(id);
  if (camada === 5) return null;
  return `n${camada + 1}${aderencia >= 70 ? "a" : "b"}`;
}

export function no(
  id: IdDeNo,
  personagem: LabPersonagem,
  contexto: string,
  estiloAdequado: LabEstilo,
  skillsEmJogo: Skills,
  opcoes: readonly [OpcaoEscrita, OpcaoEscrita, OpcaoEscrita],
  consequenciaOmissao?: string
): NoDoCenario {
  const [a, b, c] = opcoes;
  const comDestino = (o: OpcaoEscrita): OpcaoDoCenario => ({
    ...o,
    proximo: destinoDe(id, o.aderencia)
  });
  const camada = camadaDe(id);
  return {
    id,
    camada,
    personagem,
    contexto,
    estiloAdequado,
    skillsEmJogo,
    opcoes: { A: comDestino(a), B: comDestino(b), C: comDestino(c) },
    aoOmitir: camada === 5 ? null : `n${camada + 1}b`,
    ...(consequenciaOmissao ? { consequenciaOmissao } : {})
  };
}

export function pacote(args: {
  categoria: CategoriaDaBiblioteca;
  titulo: string;
  /** Encarregado, supervisor e coordenador, nessa ordem. */
  aberturas: readonly [string, string, string];
  fontes: readonly string[];
  /** Exatamente os nove nós, em qualquer ordem. */
  nos: readonly NoDoCenario[];
}): PacoteDaCategoria {
  const [encarregado, supervisor, coordenador] = args.aberturas;
  const cenario: CenarioDaBiblioteca = {
    id: args.categoria.id,
    categoriaId: args.categoria.id,
    versao: "1.0.0-demonstrativo",
    titulo: args.titulo,
    niveis: ["encarregado", "supervisor", "coordenador"],
    aberturas: { encarregado, supervisor, coordenador },
    inicio: "n1",
    // O contexto do n1 é a abertura do cargo; o texto do nó serve só de padrão (o do supervisor).
    nos: args.nos.map((n) => (n.id === "n1" ? { ...n, contexto: supervisor } : n)),
    fontes: args.fontes
  };
  return { categoria: args.categoria, cenario };
}
