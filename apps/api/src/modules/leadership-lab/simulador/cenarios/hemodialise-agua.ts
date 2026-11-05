// Cenário: água tratada para hemodiálise. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e
// pedagógica). Nível gerencial: nada aqui descreve limites de qualidade da água, desinfecção nem
// como operar o sistema de tratamento; isso é da norma, do fabricante e da responsável técnica.
import { no, opcao, pacote } from "../construtor.js";

export const hemodialiseAgua = pacote({
  categoria: {
    id: "hemodialise-agua",
    nome: "Água tratada para hemodiálise",
    descricao: "Sistemas de tratamento de água, osmose reversa e sessões de hemodiálise.",
    palavrasFortes: [
      "hemodialise",
      "dialise",
      "osmose reversa",
      "agua tratada",
      "sala de hemodialise",
      "maquina de dialise",
      "tratamento de agua",
      "dialisato"
    ],
    palavrasFracas: ["renal", "osmose", "filtro", "sessao", "paciente renal"],
    exemplos: [
      "O alarme do sistema de osmose reversa da hemodiálise disparou.",
      "A qualidade da água tratada da hemodiálise está em dúvida."
    ]
  },
  titulo: "Alarme no sistema de água da hemodiálise",
  fontes: ["cdc-agua-dialise", "anvisa-rdc-63-2011", "nhs-htm-04-01", "oms-programas"],
  aberturas: [
    "Início do turno. O alarme do sistema de água tratada da hemodiálise disparou e os pacientes já estão chegando para a sessão. O técnico pergunta se pode reiniciar o sistema. Você lidera o turno.",
    "O alarme do sistema de água tratada da hemodiálise disparou, os pacientes estão chegando para a sessão e o técnico quer reiniciar o sistema. A responsável do serviço ainda não foi avisada. Você decide a prioridade e a comunicação.",
    "Um alarme no sistema de água tratada da hemodiálise comprometeu o início das sessões. A direção quer saber o risco aos pacientes, e o contrato exige comunicação imediata. Você responde pela decisão e pelo registro."
  ],
  nos: [
    no(
      "n1",
      "responsavel-assistencial",
      "",
      "direcao",
      ["contingencia", "comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Libera o início das sessões para não atrasar os pacientes, enquanto o técnico reinicia o sistema.",
          "liberou as sessões enquanto o técnico reiniciava",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Iniciar sessões de hemodiálise com alarme no sistema de água, para não atrasar, é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "As sessões foram interrompidas depois, a responsável do serviço abriu uma investigação e a decisão virou registro de falha."
        ),
        opcao(
          "Segura o início das sessões, avisa a responsável do serviço, aciona o procedimento da instituição e orienta os pacientes sobre o atraso.",
          "segurou as sessões e avisou a responsável",
          "direcao",
          100,
          ["contingencia", "comunicacao-cliente", "aplicacao-nr-pop"],
          "Com alarme no sistema de água, segurar o início, avisar a responsável e seguir o procedimento vem antes de qualquer pressa.",
          "A responsável do serviço assumiu a avaliação, e os pacientes entenderam o atraso por terem sido orientados."
        ),
        opcao(
          "Segura o início das sessões, mas deixa o aviso à responsável do serviço para depois da avaliação do técnico.",
          "segurou as sessões e adiou o aviso à responsável",
          "orientacao",
          70,
          ["contingencia", "comunicacao-cliente"],
          "Segurar as sessões é correto, mas a responsável do serviço precisava ser avisada de imediato.",
          "As sessões ficaram seguradas, e a responsável reclamou de ter sido avisada depois do técnico."
        )
      ],
      "Sem decisão sua, os pacientes aguardaram sem orientação e as sessões ficaram em dúvida."
    ),
    no(
      "n2a",
      "enfermagem",
      "As sessões foram seguradas. A responsável do serviço pergunta como serão reorganizados os pacientes e o técnico pede orientação sobre a investigação.",
      "orientacao",
      ["gestao-os", "contingencia", "comunicacao-cliente"],
      [
        opcao(
          "Diz que cada paciente decida se espera ou volta outro dia.",
          "mandou cada paciente decidir se esperava",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Pacientes renais não decidem sozinhos o tempo da sessão: a reorganização é da equipe do serviço.",
          "Alguns pacientes foram embora sem orientação e a responsável do serviço precisou localizá-los depois."
        ),
        opcao(
          "Deixa a responsável do serviço organizar e se coloca à disposição.",
          "deixou a responsável organizar as sessões",
          "apoio",
          70,
          ["delegacao", "comunicacao-cliente"],
          "Colocar-se à disposição é bom, mas a responsável pedia uma proposta de reorganização.",
          "A responsável organizou com o que tinha, e a investigação do técnico ficou sem apoio."
        ),
        opcao(
          "Combina com a responsável do serviço a nova ordem dos pacientes, comunica a todos e define quem atualiza o grupo.",
          "combinou nova ordem dos pacientes e quem atualiza",
          "orientacao",
          100,
          ["gestao-os", "contingencia", "comunicacao-cliente"],
          "Reorganizar com quem conhece os pacientes e definir quem atualiza o grupo dá previsibilidade enquanto a investigação avança.",
          "Os pacientes souberam a nova ordem, e o técnico investigou sem a pressão da fila."
        )
      ]
    ),
    no(
      "n2b",
      "responsavel-assistencial",
      "As sessões iniciaram antes da avaliação e a responsável do serviço soube depois. Ela quer saber quem decidiu e se algum paciente foi exposto a risco.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Assume a decisão, suspende o que estiver em andamento conforme o procedimento, informa a responsável e a direção e registra o ocorrido.",
          "assumiu e suspendeu o que estava em andamento",
          "direcao",
          100,
          ["decisao-pressao", "aplicacao-nr-pop", "comunicacao-cliente"],
          "Quando as sessões começaram sem avaliação, assumir, suspender conforme o procedimento, informar e registrar protege os pacientes.",
          "As sessões foram suspensas conforme o procedimento, a responsável conduziu a avaliação e a direção foi informada."
        ),
        opcao(
          "Explica o que houve à responsável e promete uma resposta mais completa depois.",
          "explicou o ocorrido e prometeu resposta depois",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Explicar é necessário, mas a suspensão das sessões em andamento não podia esperar.",
          "A responsável aceitou a explicação, mas cobrou a suspensão imediata das sessões."
        ),
        opcao(
          "Diz que as sessões já começaram e que não há o que fazer agora.",
          "disse que não havia o que fazer agora",
          null,
          40,
          ["decisao-pressao", "comunicacao-cliente"],
          "Dizer que não há o que fazer abandona pacientes que podem estar expostos e a responsável que precisa decidir.",
          "A responsável tomou a frente sem apoio da manutenção e levou a queixa à diretoria."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. A responsável do serviço quer saber se as sessões da tarde podem ocorrer e pede um posicionamento claro por escrito.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Diz que a manutenção está trabalhando e pede confiança.",
          "disse que a manutenção trabalhava e pediu confiança",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Pedir confiança acolhe, mas a responsável precisava de um posicionamento por escrito.",
          "A responsável aceitou, mas voltou a pedir o texto antes de decidir sobre as sessões da tarde."
        ),
        opcao(
          "Envia o que se sabe, o que está em avaliação, as medidas provisórias e o horário em que decidirão sobre as sessões da tarde.",
          "enviou posicionamento escrito com horário de decisão",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Um posicionamento escrito, honesto sobre o que está em avaliação e com horário de decisão, dá à responsável o que ela precisa.",
          "A responsável decidiu sobre as sessões no horário combinado e agradeceu a clareza."
        ),
        opcao(
          "Diz que a decisão sobre as sessões é só dela.",
          "disse que a decisão era só dela",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A decisão é da responsável, mas ela precisa das informações do equipamento, que são de quem coordena a manutenção.",
          "A responsável decidiu sem dados do equipamento, e cancelou sessões que talvez pudessem ocorrer."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. A responsável do serviço exige saber se as sessões da tarde podem ocorrer e diz que não aceita mais informações incompletas.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Assume a informação incompleta, apresenta o que se sabe e define com ela o critério e o horário da decisão.",
          "assumiu a informação incompleta e definiu critério e horário",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Assumir a informação incompleta e combinar critério e horário de decisão recupera a confiança sem prometer o que não se controla.",
          "A responsável aceitou o critério e passou a cobrar o horário combinado."
        ),
        opcao(
          "Diz que não há como saber antes de a manutenção concluir.",
          "disse que não havia como saber antes de concluir",
          null,
          40,
          ["comunicacao-cliente"],
          "Dizer que nada se sabe deixa a responsável sem base, quando poderia ter ao menos o que já foi apurado.",
          "A responsável cancelou as sessões da tarde por precaução e registrou a queixa."
        ),
        opcao(
          "Apresenta o que se sabe, sem definir o horário da decisão.",
          "apresentou o que sabia sem definir horário",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Mostrar o que se sabe ajuda, mas sem horário de decisão a responsável segue sem referência.",
          "A responsável aceitou os fatos, mas cobrou um horário antes do fim do plantão."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "A empresa especializada propõe liberar o sistema depois de um ajuste rápido, sem aguardar a confirmação formal da qualidade da água, para aproveitar o horário da tarde.",
      "direcao",
      ["aplicacao-nr-pop", "materiais-custos", "decisao-pressao"],
      [
        opcao(
          "Aceita, por confiar na empresa e para recuperar o atraso das sessões.",
          "aceitou liberar sem a confirmação formal",
          "apoio",
          40,
          ["materiais-custos", "aplicacao-nr-pop"],
          "Confiança e pressa não substituem a confirmação formal da qualidade da água antes de uma sessão.",
          "A liberação antecipada foi apontada como desvio, e as sessões tiveram de ser suspensas de novo."
        ),
        opcao(
          "Pede que a empresa antecipe a confirmação e decide sobre a liberação depois, sem consultar a responsável do serviço.",
          "pediu antecipar a confirmação e decidiu sem a responsável",
          "orientacao",
          70,
          ["materiais-custos", "gestao-os"],
          "Pedir a antecipação é bom, mas a liberação afeta a responsável do serviço e deveria ser decidida com ela.",
          "A confirmação veio mais cedo, porém a responsável soube da liberação sem ter sido consultada."
        ),
        opcao(
          "Exige a confirmação formal da qualidade da água antes de liberar, informa a responsável do serviço e reorganiza as sessões.",
          "exigiu a confirmação formal e reorganizou as sessões",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
          "Exigir a confirmação formal antes de liberar, mesmo com o horário apertado, protege pacientes em hemodiálise.",
          "A confirmação veio por escrito, a responsável reorganizou as sessões e tudo ficou registrado."
        )
      ],
      "Sem decisão sua, a empresa liberou o sistema antes da confirmação formal."
    ),
    no(
      "n4b",
      "tecnico",
      "A pressão dos pacientes cresce e um técnico sugere usar a água de uma sessão anterior, “que estava boa”, para não cancelar a sessão da tarde.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
      [
        opcao(
          "Recusa a sugestão, explica o motivo ao técnico e aos pacientes e mantém a sessão suspensa até a liberação formal.",
          "recusou a sugestão e manteve a sessão suspensa",
          "direcao",
          100,
          ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
          "Sob pressão dos pacientes, a liberação formal não se substitui por sugestão de improviso: recusar e explicar protege todos.",
          "O técnico entendeu o motivo, os pacientes foram orientados e a sessão só ocorreu com liberação formal."
        ),
        opcao(
          "Autoriza usar a água da sessão anterior para evitar o cancelamento.",
          "autorizou usar a água da sessão anterior",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Autorizar um improviso com a água de hemodiálise, para evitar cancelamento, é o oposto do esperado. Gera alerta vermelho.",
          "A responsável do serviço interrompeu o improviso, abriu investigação e a decisão virou registro de falha."
        ),
        opcao(
          "Pede ao técnico que decida com a enfermagem o que for melhor.",
          "deixou o técnico decidir com a enfermagem",
          "apoio",
          40,
          ["delegacao", "aplicacao-nr-pop"],
          "A decisão sobre usar ou não a água é de quem coordena e da responsável do serviço, e não do técnico com a enfermagem.",
          "O técnico e a enfermagem discordaram, e a sessão ficou num limbo, sem registro de quem decidiu."
        )
      ],
      "Sem decisão sua, o técnico e a enfermagem decidiram por conta própria e o fato ficou sem registro."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. O sistema foi liberado com confirmação formal e as sessões foram reorganizadas. A direção quer um relato e saber o que muda no aviso de alarmes.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
      [
        opcao(
          "Relata com a linha do tempo, reconhece a equipe e propõe ajustar o fluxo de aviso e a reorganização das sessões, com dono e prazo.",
          "relatou, reconheceu a equipe e propôs ajuste",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Relato claro, reconhecimento da equipe e um ajuste com dono e prazo fecham o ciclo e previnem repetição.",
          "A direção aprovou o ajuste, e os próximos alarmes foram comunicados com mais rapidez."
        ),
        opcao(
          "Diz que foi um alarme comum e que não há o que mudar.",
          "disse que foi alarme comum",
          null,
          40,
          ["comunicacao-cliente"],
          "Tratar como comum o que quase levou a iniciar sessões sem avaliação desperdiça o aprendizado.",
          "A pressão para iniciar sessões antes da avaliação voltou a aparecer no alarme seguinte."
        ),
        opcao(
          "Relata os fatos e agradece à equipe, sem propor ajuste.",
          "relatou os fatos e agradeceu à equipe",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e agradecer é bom, mas faltou transformar o aprendizado em melhoria concreta.",
          "A direção aceitou o relato e perguntou, na semana seguinte, o que tinha mudado."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. Parte das sessões foi cancelada, pacientes reclamaram e a direção exige explicação. A equipe discorda sobre quem devia ter decidido.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume parte da falha e promete rever o fluxo de decisão.",
          "assumiu parte da falha e prometeu rever o fluxo",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
          "A direção valorizou a franqueza e pediu um plano concreto para a semana seguinte."
        ),
        opcao(
          "Assume a falha de coordenação, relata a linha do tempo, ouve a equipe e propõe fluxo de decisão e aviso com dono e data.",
          "assumiu a falha e propôs fluxo com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir a equipe e propor um fluxo de decisão com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o fluxo, e a equipe sentiu que o erro foi tratado sem procurar culpados."
        ),
        opcao(
          "Culpa o técnico e a empresa especializada pelos cancelamentos.",
          "culpou o técnico e a empresa pelos cancelamentos",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar os outros esconde a falha de coordenação e afasta quem poderia ajudar a corrigir.",
          "A equipe se sentiu exposta, e a empresa especializada reduziu a cooperação."
        )
      ]
    )
  ]
});
