// Leadership Lab — o que as rotas /simulador devolvem: temas e a classificação do texto livre.
//
// Só dados de catálogo (id, nome, descrição, exemplos). Nenhum cenário, nenhuma avaliação.
import type { LabClassificacao, LabTemaSimulado, LabTemasSimulados } from "@my-flux/shared";
import { categoriaDa, categoriasDaBiblioteca } from "./catalogo.js";
import { classificar } from "./classificador.js";
import type { CategoriaDaBiblioteca } from "./tipos.js";

function tema(c: CategoriaDaBiblioteca): LabTemaSimulado {
  return { id: c.id, nome: c.nome, descricao: c.descricao, exemplos: [...c.exemplos] };
}

export function temasDaBiblioteca(): LabTemasSimulados {
  return { temas: categoriasDaBiblioteca.map(tema) };
}

function temasPorId(ids: readonly string[]): LabTemaSimulado[] {
  return ids.flatMap((id) => {
    const c = categoriaDa(id);
    return c ? [tema(c)] : [];
  });
}

/** Classifica a descrição. Nunca guarda nem registra o texto. */
export function descreverClassificacao(descricao: string): LabClassificacao {
  const r = classificar(descricao, categoriasDaBiblioteca);
  switch (r.resultado) {
    case "encontrado": {
      const [escolhido] = temasPorId([r.categoriaId]);
      if (!escolhido)
        return { resultado: "sem-correspondencia", sugestoes: temasDaBiblioteca().temas };
      return { resultado: "encontrado", tema: escolhido };
    }
    case "ambiguo": {
      const sugestoes = temasPorId(r.categoriaIds);
      if (sugestoes.length < 2) {
        return { resultado: "sem-correspondencia", sugestoes: temasDaBiblioteca().temas };
      }
      return { resultado: "ambiguo", sugestoes };
    }
    case "sem-correspondencia":
      return { resultado: "sem-correspondencia", sugestoes: temasDaBiblioteca().temas };
  }
}
