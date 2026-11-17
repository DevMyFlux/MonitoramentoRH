// Assistente de suporte — onde a pessoa está. Puro, para ser testado à parte.
//
// O nome da tela vai para a IA (para responder sobre a tela atual quando a pergunta é vaga) e as
// sugestões aparecem no início da conversa. A ordem importa: o prefixo mais específico vem antes.

export type ContextoDaPagina = { titulo: string; sugestoes: readonly string[] };

const CONTEXTOS: ReadonlyArray<{ prefixo: string } & ContextoDaPagina> = [
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
  { prefixo: "/qlp", titulo: "QLP", sugestoes: ["O que é o QLP?", "Como o QLP gera posições?"] },
  {
    prefixo: "/recrutamento",
    titulo: "Recrutamento",
    sugestoes: ["Como abro uma vaga?", "Como concluo uma admissão?"]
  },
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
  return !(caminho === "/lab/teste" || caminho.startsWith("/lab/teste/"));
}
