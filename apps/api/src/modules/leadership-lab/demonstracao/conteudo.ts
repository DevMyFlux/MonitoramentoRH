// Leadership Lab — o conteúdo do modo demonstração: cinco situações escritas à mão.
//
// É CONTEÚDO DE EXEMPLO, não pedagógico: serve para mostrar as telas funcionando enquanto o
// serviço de IA real não existe. O dono do conteúdo pedagógico do Lab é decisão do negócio (em
// aberto), então nada aqui deve ser lido como o teste de verdade. Toda situação sai da IA de
// demonstração com o prefixo "(Demonstração)".
//
// Convenção usada para pontuar (a IA real decide por conta própria): cada situação tem um estilo
// adequado, e cada opção representa um estilo. A aderência cai conforme a distância na ordem
// direção, orientação, apoio e delegação: 0 = 100, 1 = 70, 2 = 40, 3 = 10. Uma opção que não
// envolve a equipe (estilo nulo) recebe a nota escrita à mão. A aderência 10 gera o alerta
// vermelho, e só a situação 4 tem uma opção assim, para mostrar como o alerta aparece.
import type { LabEscolha, LabEstilo, LabSkillId } from "@my-flux/shared";

export const PREFIXO_DA_DEMONSTRACAO = "(Demonstração) ";

export type OpcaoDeDemonstracao = {
  texto: string;
  /** Nulo quando a escolha não envolve a equipe. */
  estilo: LabEstilo | null;
  aderencia: 100 | 70 | 40 | 10;
  skills: readonly LabSkillId[];
  justificativa: string;
  consequencia: string;
};

export type SituacaoDeDemonstracao = {
  estiloAdequado: LabEstilo;
  texto: string;
  /** As skills que a situação põe em jogo: uma omissão (tempo esgotado) conta zero nelas. */
  skillsEmJogo: readonly LabSkillId[];
  opcoes: Record<LabEscolha, OpcaoDeDemonstracao>;
};

export const situacoesDeDemonstracao: readonly SituacaoDeDemonstracao[] = [
  {
    estiloAdequado: "direcao",
    skillsEmJogo: ["gestao-os", "aplicacao-nr-pop", "comunicacao-cliente"],
    texto:
      "Segunda-feira, 8h. Chegam duas ordens de serviço: ar-condicionado parado na sala da diretoria e vazamento no banheiro do térreo, com piso molhado. Só há uma equipe livre, e a diretoria já ligou duas vezes cobrando.",
    opcoes: {
      A: {
        texto:
          "Manda a equipe ao vazamento, isola o piso com sinalização e avisa a diretoria do novo prazo.",
        estilo: "direcao",
        aderencia: 100,
        skills: ["gestao-os", "aplicacao-nr-pop", "comunicacao-cliente"],
        justificativa:
          "Risco de queda pesa mais que conforto. A escolha priorizou a segurança, isolou a área e comunicou o prazo a quem cobrava.",
        consequencia:
          "O piso foi isolado a tempo, ninguém se machucou e a diretoria aceitou o prazo por ter sido avisada."
      },
      B: {
        texto: "Atende primeiro a diretoria para parar as ligações e vai ao vazamento depois.",
        estilo: null,
        aderencia: 40,
        skills: ["gestao-os", "decisao-pressao"],
        justificativa:
          "A escolha cedeu à pressão de quem cobrava. O piso molhado ficou sem isolamento enquanto a equipe estava em outro lugar.",
        consequencia:
          "A diretoria ficou satisfeita, mas uma pessoa escorregou no térreo antes de a equipe chegar."
      },
      C: {
        texto:
          "Reúne a equipe, explica o risco do piso molhado e combina com ela a ordem dos dois chamados.",
        estilo: "orientacao",
        aderencia: 70,
        skills: ["gestao-os", "aplicacao-nr-pop", "gestao-equipe"],
        justificativa:
          "Explicar o risco ajuda, mas a urgência pedia uma ordem clara. A conversa atrasou a saída da equipe.",
        consequencia:
          "A equipe entendeu a prioridade, mas saiu alguns minutos depois e a diretoria ligou de novo."
      }
    }
  },
  {
    estiloAdequado: "orientacao",
    skillsEmJogo: ["materiais-custos", "gestao-equipe", "delegacao"],
    texto:
      "Terça, 14h. Faltam as válvulas para trocar a bomba do reservatório, que está parada. O almoxarifado só repõe na quinta, e o técnico mais novo, aflito, sugere comprar uma peça parecida por conta própria, sem cotação nem aprovação.",
    opcoes: {
      A: {
        texto: "Proíbe a compra por conta própria e manda aguardar a reposição de quinta.",
        estilo: "direcao",
        aderencia: 70,
        skills: ["materiais-custos", "gestao-equipe"],
        justificativa:
          "Barrar a compra sem aprovação foi correto, mas faltou ouvir a preocupação do técnico e buscar uma saída para a bomba parada.",
        consequencia:
          "A regra foi mantida, mas o reservatório ficou parado até quinta e o técnico se sentiu ignorado."
      },
      B: {
        texto: "Deixa o técnico decidir sozinho se compra a peça parecida e como pagar.",
        estilo: "delegacao",
        aderencia: 40,
        skills: ["materiais-custos", "delegacao"],
        justificativa:
          "Um técnico novo ainda não tem o preparo para essa decisão. Delegar aqui expôs a operação a uma peça inadequada e a um gasto sem aprovação.",
        consequencia:
          "A peça comprada não serviu, o dinheiro saiu do caixa do técnico e a bomba continuou parada."
      },
      C: {
        texto:
          "Explica o risco de uma peça inadequada, aciona a compra emergencial com aprovação e pede a ele a cotação de fornecedores.",
        estilo: "orientacao",
        aderencia: 100,
        skills: ["materiais-custos", "delegacao", "gestao-equipe"],
        justificativa:
          "A escolha explicou o motivo da regra, deu um caminho legítimo e envolveu o técnico no processo, que é o que alguém em desenvolvimento precisa.",
        consequencia:
          "A peça certa chegou no dia seguinte, com aprovação, e o técnico aprendeu a cotar."
      }
    }
  },
  {
    estiloAdequado: "apoio",
    skillsEmJogo: ["comunicacao-cliente", "gestao-equipe"],
    texto:
      "Quinta, 10h. A reposição atrasou e o prazo prometido ao cliente vence hoje. A coordenadora do cliente, irritada, chamou de incompetente, em público, a sua melhor técnica, que fechou três chamados difíceis esta semana. A técnica está em lágrimas.",
    opcoes: {
      A: {
        texto:
          "Pede que ela se recomponha e volte ao posto, sem conversar agora, para cumprir o prazo.",
        estilo: "direcao",
        aderencia: 40,
        skills: ["gestao-equipe", "decisao-pressao"],
        justificativa:
          "A técnica competente precisava de apoio, não de ordem. A escolha ignorou o que ela sentia e arriscou a motivação de quem mais entrega.",
        consequencia:
          "Ela voltou ao posto em silêncio. Duas semanas depois pediu transferência de equipe."
      },
      B: {
        texto:
          "Conversa a sós com a técnica, reconhece o trabalho dela e assume o contato com a coordenadora para renegociar o prazo.",
        estilo: "apoio",
        aderencia: 100,
        skills: ["comunicacao-cliente", "gestao-equipe"],
        justificativa:
          "A escolha deu apoio a quem estava abalada e protegeu a técnica, assumindo você mesmo a conversa difícil com o cliente.",
        consequencia:
          "A técnica se recompôs, a coordenadora aceitou um novo prazo e a equipe viu que será defendida."
      },
      C: {
        texto:
          "Diz à técnica o que responder à coordenadora na próxima ligação e cobra que siga o roteiro.",
        estilo: "orientacao",
        aderencia: 70,
        skills: ["comunicacao-cliente", "gestao-equipe"],
        justificativa:
          "O roteiro ajuda com o cliente, mas a técnica precisava primeiro de acolhimento. A orientação veio antes do apoio.",
        consequencia:
          "A ligação seguinte foi melhor, mas a técnica seguiu abalada e rendeu menos no resto do dia."
      }
    }
  },
  {
    estiloAdequado: "direcao",
    skillsEmJogo: ["aplicacao-nr-pop", "decisao-pressao"],
    texto:
      "Quarta, 16h. Um eletricista terceirizado quer religar um painel sem bloqueio e etiquetagem para ganhar tempo, e diz que sempre fez assim. O cliente exige a energia de volta às 17h.",
    opcoes: {
      A: {
        texto:
          "Interrompe o serviço, exige o bloqueio e a etiquetagem e acompanha o procedimento até o fim.",
        estilo: "direcao",
        aderencia: 100,
        skills: ["aplicacao-nr-pop", "decisao-pressao"],
        justificativa:
          "Segurança elétrica não se negocia. A escolha foi firme, manteve o procedimento e não cedeu ao prazo do cliente.",
        consequencia:
          "O painel foi religado com segurança às 17h10, e o cliente aceitou os dez minutos de atraso."
      },
      B: {
        texto: "Pede que ele se cuide e acompanha de longe, pois ele tem experiência.",
        estilo: "apoio",
        aderencia: 40,
        skills: ["aplicacao-nr-pop"],
        justificativa:
          "Confiar na experiência não substitui o procedimento. A escolha deixou o risco com quem queria pular a regra.",
        consequencia:
          "Nada aconteceu desta vez, mas o procedimento foi pulado e ficou registrado como falha."
      },
      C: {
        texto: "Deixa por conta dele, que conhece o painel, para entregar a energia no horário.",
        estilo: "delegacao",
        aderencia: 10,
        skills: ["aplicacao-nr-pop", "decisao-pressao"],
        justificativa:
          "Entregar a decisão a quem propôs quebrar a regra de segurança, para cumprir um prazo, é o oposto do que a situação exigia. Gera alerta vermelho.",
        consequencia:
          "Houve um arco elétrico no painel. Ninguém se feriu gravemente, mas o serviço parou e a operação foi notificada."
      }
    }
  },
  {
    estiloAdequado: "delegacao",
    skillsEmJogo: ["gestao-equipe", "delegacao"],
    texto:
      "Sexta, 9h. Dois técnicos disputam quem faz a ronda do fim de semana, e um deles ameaça não vir. Ambos são confiáveis e conhecem bem a rotina. Você precisa fechar a escala hoje.",
    opcoes: {
      A: {
        texto:
          "Ouve cada um, explica como funciona o rodízio e define você mesmo quem faz a ronda.",
        estilo: "orientacao",
        aderencia: 40,
        skills: ["gestao-equipe"],
        justificativa:
          "São dois profissionais maduros: decidir por eles desperdiçou a chance de resolverem entre si e reforçou a dependência de você.",
        consequencia:
          "A escala fechou no mesmo dia, mas quem perdeu a disputa passou o fim de semana contrariado."
      },
      B: {
        texto:
          "Conversa com cada um, reconhece a disponibilidade deles e pede que cheguem a um acordo com a sua ajuda.",
        estilo: "apoio",
        aderencia: 70,
        skills: ["gestao-equipe", "delegacao"],
        justificativa:
          "Boa escuta e apoio, mas a sua presença na negociação ainda segura a decisão com você, quando eles podiam conduzi-la.",
        consequencia:
          "Eles chegaram a um acordo no fim do dia, depois de uma reunião mais longa do que o necessário."
      },
      C: {
        texto:
          "Pede que os dois definam entre si um critério justo de rodízio e te avisem até o meio-dia.",
        estilo: "delegacao",
        aderencia: 100,
        skills: ["gestao-equipe", "delegacao"],
        justificativa:
          "Entregou a decisão a quem tem maturidade para tomá-la, com prazo claro. Isso resolve o conflito e fortalece o time.",
        consequencia:
          "Eles combinaram um rodízio mensal, avisaram antes do meio-dia e o critério passou a valer para toda a equipe."
      }
    }
  }
];
