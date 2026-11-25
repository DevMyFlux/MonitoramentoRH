// Assistente de suporte — onde a pessoa está. Puro, para ser testado à parte.
//
// O nome da tela vai para a IA (para responder sobre a tela atual quando a pergunta é vaga) e as
// sugestões aparecem no início da conversa. A ordem importa: o prefixo mais específico vem antes.

import { contextosOcultos } from "../../_hidden/contexto-do-assistente";

export type ContextoDaPagina = { titulo: string; sugestoes: readonly string[] };

const CONTEXTOS: ReadonlyArray<{ prefixo: string } & ContextoDaPagina> = [
  {
    prefixo: "/treinamentos/rh",
    titulo: "Treinamentos · Acompanhamento do RH",
    sugestoes: [
      "Como valido um treinamento?",
      "Quem aparece nesta lista?",
      "Como leio o resultado de um treinamento?"
    ]
  },
  {
    prefixo: "/treinamentos/config",
    titulo: "Treinamentos · Configuração",
    sugestoes: [
      "Como cadastro um cenário de treinamento?",
      "O que acontece quando aprovo uma versão?",
      "Como atribuo um treinamento a uma turma?"
    ]
  },
  {
    prefixo: "/treinamentos",
    titulo: "Treinamentos interativos",
    sugestoes: [
      "Como funciona um treinamento interativo?",
      "Como leio o resultado de um treinamento?",
      "Posso refazer um treinamento?"
    ]
  },
  {
    prefixo: "/lab/rh",
    titulo: "Leadership Lab · Acompanhamento do RH",
    sugestoes: [
      "Como cadastro um participante?",
      "Como valido um resultado?",
      "O que faço com um alerta?"
    ]
  },
  {
    prefixo: "/lab/config",
    titulo: "Leadership Lab · Configuração",
    sugestoes: [
      "Como libero um molde de teste?",
      "Como ligo um cargo a um molde?",
      "O que mostra o consumo de IA?"
    ]
  },
  {
    prefixo: "/lab/aprendizagem",
    titulo: "Leadership Lab · Aprendizagem",
    sugestoes: ["Para que serve a aprendizagem?", "Quantas mensagens posso enviar?"]
  },
  {
    prefixo: "/lab/resultado",
    titulo: "Leadership Lab · Resultado do teste",
    sugestoes: [
      "Como leio o meu resultado?",
      "Posso contestar o resultado?",
      "Quem valida o resultado?"
    ]
  },
  {
    prefixo: "/lab",
    titulo: "Leadership Lab · Painel",
    sugestoes: [
      "Como funciona o teste?",
      "O que é o termo de ciência?",
      'Por que aparece "sem vínculo"?'
    ]
  },
  {
    prefixo: "/colaboradores",
    titulo: "Colaboradores",
    sugestoes: [
      "Como cadastro um colaborador?",
      "Como registro férias ou atestado?",
      "Como exporto a lista?"
    ]
  },
  {
    prefixo: "/escalas",
    titulo: "Escalas",
    sugestoes: [
      "Como gero a escala do mês?",
      "O que é uma pendência impeditiva?",
      "Como funciona o rodízio Par/Ímpar?"
    ]
  },
  {
    prefixo: "/usuarios",
    titulo: "Usuários",
    sugestoes: ["Como crio um usuário?", "Qual a diferença entre os perfis?"]
  },
  ...contextosOcultos(),
  { prefixo: "/auditoria", titulo: "Auditoria", sugestoes: ["Quem pode ver a auditoria?"] },
  {
    prefixo: "/parametros",
    titulo: "Parâmetros",
    sugestoes: ["Como configuro um turno?"]
  }
];

const PADRAO: ContextoDaPagina = {
  titulo: "MY FLUX",
  sugestoes: [
    "O que posso fazer no MY FLUX?",
    "Quais são os perfis de acesso?",
    "Como funciona a escala?"
  ]
};

/** Perfis que podem perguntar sobre dados de colaboradores (o servidor confere de novo). */
const PERFIS_COM_DADOS = ["DEV", "ADMIN", "RH"];

const PERGUNTAS_DE_DADOS = ["Quantos colaboradores temos?", "Quem foi desligado recentemente?"];

/** As sugestões da tela; quem pode ver dados de pessoas ganha também perguntas sobre os dados. */
export function sugestoesDaPagina(caminho: string, perfil: string | undefined): readonly string[] {
  const base = contextoDaPagina(caminho).sugestoes;
  if (!perfil || !PERFIS_COM_DADOS.includes(perfil)) return base;
  return [...PERGUNTAS_DE_DADOS, ...base].slice(0, 4);
}

export function contextoDaPagina(caminho: string): ContextoDaPagina {
  const achado = CONTEXTOS.find(
    (c) => caminho === c.prefixo || caminho.startsWith(`${c.prefixo}/`)
  );
  return achado ?? PADRAO;
}

/**
 * Durante o teste do Leadership Lab o assistente some: ele nunca ajuda numa situação cronometrada
 * (o servidor também recusa, para quem tem um teste em andamento).
 */
export function assistenteVisivelEm(caminho: string): boolean {
  if (caminho === "/lab/teste" || caminho.startsWith("/lab/teste/")) return false;
  // No Palco dos Treinamentos (a sessão e o desfecho) o assistente também some.
  return !/^\/treinamentos\/(resultado\/[^/]+|[^/]+\/jogar)\/?$/.test(caminho);
}
