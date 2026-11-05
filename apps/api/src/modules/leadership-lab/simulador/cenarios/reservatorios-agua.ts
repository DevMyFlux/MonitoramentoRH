// Cenário: reservatórios e água do hospital. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e
// pedagógica). Nível gerencial: nada aqui descreve como limpar, medir ou tratar a água; isso é da
// norma, do procedimento do Grand Massif e da orientação do controle de infecção.
import { no, opcao, pacote } from "../construtor.js";

export const reservatoriosAgua = pacote({
  categoria: {
    id: "reservatorios-agua",
    nome: "Reservatórios e água do hospital",
    descricao: "Reservatórios, abastecimento e qualidade da água em áreas assistenciais.",
    palavrasFortes: [
      "reservatorio",
      "caixa d agua",
      "cisterna",
      "abastecimento de agua",
      "falta de agua",
      "qualidade da agua",
      "agua do hospital",
      "legionella"
    ],
    palavrasFracas: [
      "agua",
      "bomba",
      "vazamento",
      "torneira",
      "odor",
      "cor",
      "cheiro",
      "turva",
      "suja"
    ],
    exemplos: [
      "A água de um setor saiu com cor e cheiro diferentes.",
      "A caixa d'água do prédio principal está com pouca água."
    ]
  },
  titulo: "Alteração na água de um setor assistencial",
  fontes: ["nhs-htm-04-01", "anvisa-rdc-63-2011", "cdc-controle-ambiental", "oms-programas"],
  aberturas: [
    "Início do turno. A enfermagem relata que a água de um setor saiu com cor e cheiro diferentes. O técnico pergunta se pode fazer um teste rápido e seguir. Você lidera o turno. Qual é o primeiro passo?",
    "A enfermagem relatou água com cor e cheiro diferentes num setor assistencial. O técnico quer investigar sozinho, o controle de infecção ainda não foi avisado e há pacientes vulneráveis na área. Você decide a prioridade.",
    "Há relato de água com aspecto diferente num setor assistencial e a direção quer saber se há risco. O controle de infecção pede ser acionado, e o contrato exige comunicação imediata. Você responde pela decisão."
  ],
  nos: [
    no(
      "n1",
      "controle-infeccao",
      "",
      "direcao",
      ["contingencia", "comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Deixa o técnico investigar sozinho e relatar depois, para não alarmar o setor.",
          "deixou o técnico investigar sem avisar o setor",
          "delegacao",
          40,
          ["delegacao", "comunicacao-cliente"],
          "Investigar sem avisar o setor nem o controle de infecção mantém o risco escondido de quem poderia se proteger.",
          "O setor continuou usando a água, e o controle de infecção soube do caso por terceiros."
        ),
        opcao(
          "Pede que o setor evite usar a água por precaução e avisa o controle de infecção só no fim do turno.",
          "pediu precaução e adiou o aviso ao controle de infecção",
          "orientacao",
          70,
          ["contingencia", "comunicacao-cliente"],
          "A precaução é correta, mas o controle de infecção precisava ser acionado de imediato.",
          "O setor evitou a água, porém o controle de infecção reclamou de ter sido avisado tarde."
        ),
        opcao(
          "Aciona o controle de infecção e o procedimento da instituição, orienta o setor a suspender o uso até a avaliação e registra a ocorrência.",
          "acionou o controle de infecção e suspendeu o uso",
          "direcao",
          100,
          ["contingencia", "comunicacao-cliente", "aplicacao-nr-pop"],
          "Diante de alteração na água de área com pacientes vulneráveis, acionar o controle de infecção, suspender o uso e registrar é a resposta firme.",
          "O controle de infecção assumiu a avaliação, o setor soube o que fazer e a ocorrência ficou registrada."
        )
      ],
      "Sem decisão sua, o setor continuou usando a água e ninguém avisou o controle de infecção."
    ),
    no(
      "n2a",
      "tecnico",
      "Com o setor orientado, o técnico pede apoio para investigar a origem, e o setor pergunta como ficará sem água por algum tempo.",
      "orientacao",
      ["gestao-os", "contingencia", "comunicacao-cliente"],
      [
        opcao(
          "Deixa o setor combinar a alternativa e oferece ajuda se precisarem.",
          "deixou o setor combinar a alternativa de água",
          "apoio",
          70,
          ["delegacao", "comunicacao-cliente"],
          "Oferecer ajuda é bom, mas a alternativa de água para os cuidados deve ser combinada com o controle de infecção.",
          "O setor improvisou uma alternativa e precisou refazê-la depois da orientação do controle de infecção."
        ),
        opcao(
          "Combina com o controle de infecção e o setor uma alternativa de água para os cuidados e mantém o técnico na investigação.",
          "combinou alternativa de água e manteve a investigação",
          "orientacao",
          100,
          ["contingencia", "comunicacao-cliente", "gestao-os"],
          "Uma alternativa combinada com o controle de infecção e o setor mantém o cuidado enquanto a investigação avança.",
          "O setor seguiu os cuidados com a alternativa combinada, e o técnico trabalhou sem pressão."
        ),
        opcao(
          "Diz ao setor que se vire com o que tem até a conclusão.",
          "mandou o setor se virar até a conclusão",
          null,
          40,
          ["comunicacao-cliente", "gestao-equipe"],
          "Deixar o setor sem alternativa transfere o problema para quem cuida dos pacientes.",
          "O setor improvisou por conta própria, e o controle de infecção questionou o que foi feito."
        )
      ]
    ),
    no(
      "n2b",
      "enfermagem",
      "O técnico investigou sozinho, o setor continuou usando a água e o controle de infecção soube por terceiros. Ele cobra explicação e pergunta se há pacientes expostos.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Assume a falha, manda suspender o uso, informa o controle de infecção e a direção e registra a linha do tempo.",
          "assumiu a falha, suspendeu o uso e registrou",
          "direcao",
          100,
          ["decisao-pressao", "comunicacao-cliente", "aplicacao-nr-pop"],
          "Quando o aviso falhou, assumir, suspender o uso, informar e registrar corrige o rumo e protege os pacientes.",
          "O uso foi suspenso, o controle de infecção passou a conduzir a avaliação e a direção foi informada."
        ),
        opcao(
          "Pede ao técnico que explique ao controle de infecção o que fez.",
          "pediu ao técnico que explicasse ao controle de infecção",
          "delegacao",
          40,
          ["delegacao", "decisao-pressao"],
          "Passar a explicação ao técnico expõe-o e deixa o controle de infecção sem um interlocutor que decida.",
          "O técnico explicou o que pôde, e o controle de infecção exigiu uma resposta de quem coordenava."
        ),
        opcao(
          "Explica ao controle de infecção o que houve e promete avisar depois do resultado.",
          "explicou o ocorrido e prometeu avisar depois",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Explicar ajuda, mas o uso da água precisava ser suspenso e a direção informada agora.",
          "O controle de infecção aceitou a explicação, mas cobrou a suspensão do uso ainda no mesmo turno."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. A direção assistencial pergunta se os pacientes do setor estão protegidos e quer um posicionamento claro, por escrito.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Garante que a situação está sob controle e que ela pode ficar tranquila.",
          "garantiu que estava sob controle",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Tranquilizar é bom, mas garantir controle sem detalhar o que se sabe não dá à assistência o que ela pediu.",
          "A direção assistencial aceitou, mas voltou a pedir o texto antes da troca de plantão."
        ),
        opcao(
          "Diz que isso é assunto do controle de infecção.",
          "encaminhou o assunto ao controle de infecção",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A comunicação com a assistência é de quem coordena a resposta, e não só do controle de infecção.",
          "O controle de infecção, sem o quadro completo, deu respostas diferentes das suas."
        ),
        opcao(
          "Envia o que se sabe, o que está em avaliação, as medidas provisórias e quando haverá nova informação.",
          "enviou posicionamento escrito com medidas provisórias",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Um posicionamento escrito, honesto sobre o que está em avaliação e com horário de atualização, dá à assistência base para decidir.",
          "A direção assistencial usou o texto para orientar os plantões e agradeceu a clareza."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. A direção assistencial exige saber se houve exposição de pacientes e reclama de ter sido informada tarde.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Assume o atraso, informa o que se sabe e o que está em avaliação e define com ela quem comunica as famílias e quando.",
          "assumiu o atraso e definiu quem comunica as famílias",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Assumir o atraso, dizer o que se sabe e combinar quem comunica as famílias recupera a confiança e protege a transparência.",
          "A direção assistencial aceitou o combinado e assumiu a comunicação com as famílias no horário definido."
        ),
        opcao(
          "Diz que ainda não há dados e que ela aguarde.",
          "disse que não havia dados e pediu espera",
          null,
          40,
          ["comunicacao-cliente"],
          "Pedir espera sem oferecer nem o que já se sabe deixa a assistência sem referência.",
          "A direção assistencial não aguardou e escalou o caso à diretoria."
        ),
        opcao(
          "Informa o que se sabe, sem definir quem comunica as famílias.",
          "informou o que sabia sem definir a comunicação às famílias",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Informar ajuda, mas a comunicação às famílias precisa de responsável definido.",
          "A direção assistencial aceitou os fatos, mas pediu um responsável pela comunicação ainda no mesmo dia."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "A empresa contratada propõe liberar o reservatório já hoje, sem aguardar a avaliação completa, para “normalizar o abastecimento” e economizar a visita extra.",
      "direcao",
      ["materiais-custos", "aplicacao-nr-pop", "decisao-pressao"],
      [
        opcao(
          "Aceita liberar parte do abastecimento e mantém restrição nas áreas mais vulneráveis.",
          "aceitou liberar parte do abastecimento",
          "orientacao",
          70,
          ["materiais-custos", "contingencia"],
          "Manter restrição nas áreas vulneráveis é prudente, mas liberar antes da avaliação completa ainda é arriscado.",
          "O abastecimento parcial voltou, e a avaliação completa apontou ajustes que obrigaram a restringir de novo."
        ),
        opcao(
          "Exige a avaliação completa antes de liberar, combina com o controle de infecção o critério de liberação e registra a decisão.",
          "exigiu a avaliação completa antes de liberar",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "materiais-custos"],
          "Exigir a avaliação completa e combinar o critério com o controle de infecção protege os pacientes, mesmo com custo extra.",
          "A liberação veio com critério e registro, e a direção aceitou o custo da visita extra."
        ),
        opcao(
          "Aceita a proposta, por confiar na empresa e por economia.",
          "aceitou liberar por confiança e economia",
          "apoio",
          40,
          ["materiais-custos", "aplicacao-nr-pop"],
          "Confiança e economia não substituem a avaliação completa antes de liberar a água para os pacientes.",
          "A liberação antecipada foi apontada como desvio, e o setor teve de suspender o uso de novo."
        )
      ]
    ),
    no(
      "n4b",
      "supervisor",
      "A pressão cresce: o setor quer voltar a usar a água, e o técnico propõe liberar o uso “para ver se melhora”, sem esperar o controle de infecção.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "gestao-equipe"],
      [
        opcao(
          "Mantém a suspensão até a liberação formal, explica o motivo ao setor e ao técnico e reforça a alternativa provisória.",
          "manteve a suspensão até a liberação formal",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
          "Sob pressão do setor, a liberação formal não se antecipa: manter a suspensão e explicar protege os pacientes.",
          "O setor entendeu o motivo, o técnico se alinhou e a alternativa provisória seguiu funcionando."
        ),
        opcao(
          "Concorda com cautela, pedindo que o setor observe o que acontece.",
          "concordou com cautela e pediu observação",
          "apoio",
          40,
          ["aplicacao-nr-pop", "gestao-equipe"],
          "Liberar para observar transfere o teste da água para os pacientes.",
          "O uso voltou, e uma queixa de nova alteração obrigou a suspender de novo."
        ),
        opcao(
          "Autoriza liberar o uso para testar, assumindo que depois se ajusta o registro.",
          "autorizou liberar o uso para testar",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Liberar o uso da água, num setor com pacientes vulneráveis, antes da avaliação formal é o oposto do esperado. Gera alerta vermelho.",
          "A água foi usada antes da liberação, o controle de infecção abriu investigação e a decisão virou registro de falha."
        )
      ],
      "Sem decisão sua, o setor voltou a usar a água por conta própria e o fato ficou sem registro."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. A situação foi esclarecida e a água do setor foi liberada de forma segura. A direção quer um relato e saber o que muda.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
      [
        opcao(
          "Relata com a linha do tempo, reconhece o controle de infecção e propõe ajustar o fluxo de aviso, com dono e prazo.",
          "relatou, reconheceu o controle de infecção e propôs ajuste",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Relato claro, reconhecimento do controle de infecção e um ajuste com dono e prazo fecham o ciclo e previnem repetição.",
          "A direção aprovou o ajuste, e o fluxo de aviso passou a ser seguido nos plantões."
        ),
        opcao(
          "Relata os fatos e agradece às equipes, sem propor ajuste.",
          "relatou os fatos e agradeceu às equipes",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e agradecer é bom, mas faltou transformar o aprendizado em melhoria concreta.",
          "A direção aceitou o relato e perguntou, na semana seguinte, o que tinha mudado."
        ),
        opcao(
          "Diz que foi uma alteração passageira e que não há o que ajustar.",
          "disse que foi alteração passageira",
          null,
          40,
          ["comunicacao-cliente"],
          "Tratar como passageiro o que testou o fluxo de aviso desperdiça o aprendizado.",
          "O mesmo atraso de aviso voltou a ocorrer em outra ocorrência semanas depois."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. A situação segue em avaliação, o setor perdeu confiança e a direção exige explicação. As equipes divergem sobre quem deveria ter avisado quem.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Culpa o técnico por ter investigado sozinho.",
          "culpou o técnico por investigar sozinho",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar o técnico esconde a falha de coordenação que o deixou investigar sem apoio.",
          "O técnico se sentiu exposto, e a equipe passou a esconder pequenos problemas."
        ),
        opcao(
          "Assume a falha de coordenação, relata a linha do tempo, ouve as equipes e propõe um fluxo de aviso com dono e data.",
          "assumiu a falha e propôs fluxo de aviso com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir as equipes e propor um fluxo de aviso com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o fluxo, e as equipes sentiram que o erro foi tratado sem procurar culpados."
        ),
        opcao(
          "Assume parte da falha e promete revisar o fluxo de aviso.",
          "assumiu parte da falha e prometeu revisar o fluxo",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
          "A direção valorizou a franqueza e pediu um plano concreto para a semana seguinte."
        )
      ]
    )
  ]
});
