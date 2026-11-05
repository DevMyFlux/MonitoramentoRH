// Cenário: elevadores. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e pedagógica). Nível
// gerencial: nada aqui descreve como inspecionar, reparar ou resgatar em elevador; isso é da norma,
// da empresa conservadora e do procedimento do Grand Massif.
import { no, opcao, pacote } from "../construtor.js";

export const elevadores = pacote({
  categoria: {
    id: "elevadores",
    nome: "Elevadores",
    descricao:
      "Elevadores de macas, de serviço e de carga, e o fluxo de pacientes entre os andares.",
    palavrasFortes: [
      "elevador",
      "elevadores",
      "elevador de maca",
      "elevador de carga",
      "monta carga",
      "montacarga",
      "empresa de elevadores"
    ],
    palavrasFracas: ["maca", "transporte", "andar", "porta", "parado"],
    exemplos: [
      "O elevador de macas parou e há pacientes aguardando transporte.",
      "O elevador de serviço está com a porta travando."
    ]
  },
  titulo: "Elevador de macas fora de serviço",
  fontes: ["nhs-htm-08-02", "anvisa-rdc-63-2011", "oms-programas"],
  aberturas: [
    "Início do turno. O elevador de macas está fora de serviço e a equipe de transporte já tem pacientes esperando. Alguém sugere usar o elevador de carga. Você lidera o turno. O que faz primeiro?",
    "O elevador de macas está fora de serviço, o transporte de pacientes acumula e a empresa conservadora só chega à tarde. Alguém sugere usar o elevador de carga. Você decide a prioridade e como comunicar.",
    "O elevador de macas está fora de serviço e o fluxo de pacientes entre setores está comprometido. A empresa conservadora propõe prazo longo e a direção cobra solução. Você responde pelo contrato e pela segurança do fluxo."
  ],
  nos: [
    no(
      "n1",
      "enfermagem",
      "",
      "direcao",
      ["contingencia", "gestao-os", "comunicacao-cliente"],
      [
        opcao(
          "Deixa cada setor improvisar o transporte do jeito que achar melhor.",
          "deixou cada setor improvisar o transporte",
          "delegacao",
          40,
          ["delegacao", "gestao-os"],
          "Improvisos separados não formam um plano: sem coordenação, o fluxo de pacientes fica sem prioridade.",
          "Os setores improvisaram de formas diferentes, e uma maca urgente ficou esperando no corredor."
        ),
        opcao(
          "Manda priorizar os transportes urgentes e avisa os setores só no fim da manhã.",
          "mandou priorizar urgentes e avisou tarde",
          "orientacao",
          70,
          ["gestao-os", "comunicacao-cliente"],
          "Priorizar urgências é correto, mas os setores precisavam saber já da indisponibilidade do elevador.",
          "As urgências foram atendidas, mas vários setores descobriram o problema com a maca já pronta para descer."
        ),
        opcao(
          "Informa os setores e a direção, define com a assistência a prioridade dos transportes e aciona a empresa conservadora em caráter urgente.",
          "informou todos, definiu prioridades e acionou a empresa",
          "direcao",
          100,
          ["contingencia", "gestao-os", "comunicacao-cliente"],
          "Com o elevador fora de serviço, avisar os setores, definir prioridades com a assistência e acionar a empresa vem antes de improvisar.",
          "Os setores souberam cedo, a prioridade foi combinada com a assistência e a empresa tratou o chamado como urgente."
        )
      ],
      "Sem decisão sua, cada setor improvisou o transporte por conta própria."
    ),
    no(
      "n2a",
      "responsavel-assistencial",
      "Os setores foram avisados. A assistência pergunta qual rota alternativa será usada e quem acompanha os transportes mais delicados.",
      "orientacao",
      ["gestao-os", "contingencia", "comunicacao-cliente"],
      [
        opcao(
          "Oferece a equipe de transporte e deixa a assistência montar o plano.",
          "ofereceu a equipe e deixou a assistência montar o plano",
          "apoio",
          70,
          ["delegacao", "comunicacao-cliente"],
          "Oferecer a equipe é bom, mas a assistência pediu uma proposta de rota e de acompanhamento.",
          "A assistência montou o plano sozinha e pediu ajustes que a equipe não conseguiu atender."
        ),
        opcao(
          "Diz que cada setor sabe o que fazer e que não precisa interferir.",
          "disse que cada setor sabia o que fazer",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A assistência pediu orientação: dizer que cada setor se resolve deixa o fluxo sem ninguém que coordene.",
          "Cada setor escolheu uma rota diferente, e houve cruzamento de macas nos corredores."
        ),
        opcao(
          "Define com a assistência a rota alternativa e o acompanhamento e informa o que fazer se surgir novo imprevisto.",
          "definiu rota alternativa e acompanhamento com a assistência",
          "orientacao",
          100,
          ["gestao-os", "contingencia", "comunicacao-cliente"],
          "Combinar rota, acompanhamento e conduta para novo imprevisto dá previsibilidade ao fluxo de pacientes.",
          "O fluxo passou a seguir a rota combinada, e a equipe soube o que fazer diante de um novo imprevisto."
        )
      ]
    ),
    no(
      "n2b",
      "supervisor",
      "Sem aviso, os setores improvisaram o transporte e uma maca ficou parada num corredor. A responsável assistencial chegou questionando quem coordena o fluxo.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Assume a coordenação, define a rota e a ordem dos transportes, registra o ocorrido e avisa a direção.",
          "assumiu a coordenação e definiu rota e ordem",
          "direcao",
          100,
          ["decisao-pressao", "comunicacao-cliente", "contingencia"],
          "Quando o fluxo ficou sem dono, a resposta certa é assumir, definir rota e ordem, registrar e avisar a direção.",
          "O fluxo se reorganizou, a responsável viu comando na resposta e a direção foi informada."
        ),
        opcao(
          "Diz que a responsabilidade pelo transporte é de cada setor.",
          "disse que o transporte era de cada setor",
          "delegacao",
          40,
          ["delegacao", "decisao-pressao"],
          "Num momento sem dono, dizer que cada setor se vire é recusar a coordenação que a situação pedia.",
          "A responsável levou a queixa à diretoria, e os setores se queixaram da falta de direção."
        ),
        opcao(
          "Explica a situação, mas deixa a definição da rota para depois.",
          "explicou a situação e adiou a rota",
          "orientacao",
          70,
          ["comunicacao-cliente", "gestao-os"],
          "Explicar ajuda, mas a rota precisava ser definida agora para o fluxo voltar a andar.",
          "A responsável aceitou a explicação, mas cobrou a definição da rota ainda antes do almoço."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. A responsável assistencial quer saber quando o elevador volta e como ficarão as cirurgias e altas do dia seguinte.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Passa o prazo mais otimista da empresa e pede paciência.",
          "passou o prazo otimista e pediu paciência",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Repassar só a hipótese mais otimista cria uma expectativa que pode não se cumprir.",
          "A assistência manteve a agenda. Quando o prazo estourou, as cirurgias foram remarcadas na véspera."
        ),
        opcao(
          "Diz que não tem como saber e que ela decida o que fazer.",
          "disse que não tinha como saber",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Negar toda informação deixa a assistência decidindo no escuro, quando poderia ter ao menos o que já se sabe.",
          "A assistência cancelou várias altas e cirurgias por precaução, sem necessidade."
        ),
        opcao(
          "Informa o que a empresa confirmou, o que é incerto e combina com ela o horário de reavaliar as cirurgias e altas.",
          "informou o confirmado e combinou horário de reavaliação",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Separar o confirmado do incerto e marcar um horário de reavaliação permite à assistência decidir sem falsa promessa.",
          "A assistência reavaliou no horário combinado, remarcou só o necessário e agradeceu a clareza."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. A responsável assistencial reclama que o fluxo de pacientes ficou sem direção e exige um plano para as cirurgias e altas do dia seguinte.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Sugere cancelar o que depender do elevador, sem consultar os setores.",
          "sugeriu cancelar o que dependesse do elevador",
          null,
          40,
          ["decisao-pressao", "comunicacao-cliente"],
          "Cancelar tudo sem consultar os setores transfere o custo da falta de plano para os pacientes.",
          "Cirurgias e altas foram canceladas, e vários setores contestaram a decisão."
        ),
        opcao(
          "Assume a falta de direção, apresenta o que se sabe e define com ela a prioridade e a rota, com horário para reavaliar.",
          "assumiu a falta de direção e definiu prioridade e rota",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Assumir a falta de direção e definir prioridade, rota e horário de reavaliação devolve o comando e a confiança.",
          "A responsável aceitou o plano e passou a cobrar a reavaliação no horário."
        ),
        opcao(
          "Apresenta um plano geral, mas deixa o detalhe da prioridade com os setores.",
          "apresentou plano geral e deixou a prioridade aos setores",
          "orientacao",
          70,
          ["comunicacao-cliente", "delegacao"],
          "Um plano geral ajuda, mas a prioridade entre setores precisava de decisão de quem coordena.",
          "Os setores discordaram da prioridade, e a responsável pediu uma decisão final antes do fim do dia."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "A empresa conservadora sugere liberar o elevador antes da conclusão da vistoria, para atender à pressão do hospital, prometendo voltar depois para fechar a papelada.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-os", "decisao-pressao"],
      [
        opcao(
          "Exige a vistoria completa e a liberação formal antes de qualquer uso e mantém a rota alternativa.",
          "exigiu vistoria completa e liberação formal",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "gestao-os"],
          "Elevador com pacientes só volta ao uso depois da vistoria completa e da liberação formal, por mais que a pressão aperte.",
          "A vistoria foi concluída, a liberação foi formal e o fluxo voltou com segurança e registro."
        ),
        opcao(
          "Aceita liberar o elevador antes da vistoria, confiando na empresa e para aliviar o fluxo.",
          "aceitou liberar o elevador antes da vistoria",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Liberar um elevador para pacientes antes da vistoria é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "O elevador foi retirado de serviço de novo por falha, e a liberação precipitada virou registro de falha."
        ),
        opcao(
          "Aceita liberar só para casos urgentes até a vistoria terminar.",
          "aceitou liberar só para casos urgentes",
          "apoio",
          40,
          ["aplicacao-nr-pop", "gestao-os"],
          "Restringir o uso a urgências não substitui a vistoria: o risco continua para esses pacientes.",
          "As urgências usaram o elevador, e o uso antes da vistoria foi apontado como desvio."
        )
      ],
      "Sem decisão sua, a empresa liberou o elevador antes de concluir a vistoria."
    ),
    no(
      "n4b",
      "tecnico",
      "A equipe de transporte, cansada, propõe usar o elevador de carga para levar pacientes, “porque é rápido e sempre funcionou”, sem liberação da empresa.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
      [
        opcao(
          "Aceita só nos casos mais urgentes, com acompanhamento de um técnico.",
          "aceitou o uso em casos urgentes com acompanhamento",
          "orientacao",
          70,
          ["gestao-equipe", "aplicacao-nr-pop"],
          "Acompanhar ajuda, mas o elevador de carga não foi liberado para pacientes: aceitar o uso ainda é um desvio.",
          "Alguns pacientes foram levados, e o uso fora da liberação foi anotado na revisão do dia."
        ),
        opcao(
          "Proíbe o uso do elevador de carga para pacientes, explica o motivo e reforça a rota alternativa com mais pessoas.",
          "proibiu o elevador de carga e reforçou a rota",
          "direcao",
          100,
          ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
          "Um elevador de carga não é liberado para pacientes: proibir, explicar e reforçar a rota protege pacientes e equipe.",
          "A equipe entendeu o motivo, recebeu reforço na rota e o transporte seguiu sem desvio."
        ),
        opcao(
          "Concorda, pois a equipe está cansada e o prazo aperta.",
          "concordou com o uso do elevador de carga",
          "apoio",
          40,
          ["gestao-equipe", "aplicacao-nr-pop"],
          "O cansaço é real, mas usar um elevador não liberado para pacientes troca o cansaço por risco.",
          "O elevador de carga foi usado por várias horas, e o desvio apareceu na revisão."
        )
      ]
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. O elevador voltou ao serviço com liberação formal. A direção quer saber o que aconteceu e como o hospital se prepara para uma nova parada.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "contingencia"],
      [
        opcao(
          "Relata os fatos, agradece às equipes e informa que o elevador voltou.",
          "relatou os fatos e agradeceu às equipes",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e agradecer é bom, mas faltou transformar o aprendizado em preparo para uma nova parada.",
          "A direção aceitou o relato e perguntou, na semana seguinte, qual era o plano para a próxima parada."
        ),
        opcao(
          "Diz que a empresa conservadora foi a responsável pela demora.",
          "culpou a empresa conservadora pela demora",
          null,
          40,
          ["comunicacao-cliente"],
          "Atribuir tudo à empresa esconde o que a própria gestão poderia ter preparado.",
          "A direção anotou a queixa, mas o hospital continuou sem plano para a próxima parada."
        ),
        opcao(
          "Relata com a linha do tempo, reconhece as equipes e propõe um plano de transporte para próximas paradas, com dono e prazo.",
          "relatou, reconheceu as equipes e propôs plano de transporte",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "contingencia"],
          "Relato claro, reconhecimento das equipes e um plano com dono e prazo preparam o hospital para uma nova parada.",
          "A direção aprovou o plano de transporte, e as equipes passaram a treinar a rota alternativa."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. O elevador segue fora de serviço, o fluxo ficou confuso e a direção cobra explicação. Há desgaste entre transporte e enfermagem.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume a falha de coordenação, relata a linha do tempo, ouve transporte e enfermagem e propõe plano com dono e data.",
          "assumiu a falha e propôs plano com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir as equipes e propor plano com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o plano, e as equipes sentiram que o erro foi tratado sem procurar culpados."
        ),
        opcao(
          "Assume parte da falha e pede mais um dia para propor um plano.",
          "assumiu parte da falha e pediu mais um dia",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas pedir tempo sem plano ainda deixa a direção esperando.",
          "A direção deu o prazo e cobrou um plano concreto no dia seguinte."
        ),
        opcao(
          "Culpa a empresa conservadora e a equipe de transporte.",
          "culpou a empresa e a equipe de transporte",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar os outros esconde a falha de coordenação e afasta quem poderia ajudar a corrigir.",
          "A equipe de transporte se sentiu exposta, e o desgaste com a enfermagem aumentou."
        )
      ]
    )
  ]
});
