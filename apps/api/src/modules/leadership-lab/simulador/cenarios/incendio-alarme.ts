// Cenário: detecção, alarme e combate a incêndio. CONTEÚDO DEMONSTRATIVO (pendente de validação
// técnica e pedagógica). Nível gerencial: nada aqui descreve como testar, manter ou desativar um
// sistema de incêndio; isso é da norma, do procedimento do Grand Massif e do fabricante.
import { no, opcao, pacote } from "../construtor.js";

export const incendioAlarme = pacote({
  categoria: {
    id: "incendio-alarme",
    nome: "Detecção, alarme e combate a incêndio",
    descricao: "Alarmes de incêndio, detectores, extintores, hidrantes e brigada.",
    palavrasFortes: [
      "incendio",
      "alarme de incendio",
      "detector de fumaca",
      "extintor",
      "extintores",
      "hidrante",
      "sprinkler",
      "brigada",
      "central de alarme"
    ],
    palavrasFracas: ["fumaca", "fogo", "evacuacao", "sirene", "alarme"],
    exemplos: [
      "O alarme de incêndio da internação dispara sem motivo.",
      "Os extintores do setor estão com a inspeção vencida."
    ]
  },
  titulo: "Falsos alarmes de incêndio em área assistencial",
  fontes: ["nhs-htm-05-01", "nhs-htm-05-03", "anvisa-rdc-63-2011", "oms-programas"],
  aberturas: [
    "Pela terceira vez no dia, o alarme de incêndio da internação disparou sem fogo. A enfermagem quer que alguém “desligue aquilo”, e o técnico espera sua decisão. Você lidera o turno. O que faz?",
    "O alarme de incêndio da internação disparou pela terceira vez no dia sem fogo. A enfermagem pede que alguém desative a zona, o técnico espera sua decisão e o responsável pela brigada quer ser avisado. Você decide a prioridade.",
    "Falsos alarmes de incêndio se repetem numa área de internação e a direção questiona se o sistema é confiável. A brigada pede definição, e o contrato exige manter a proteção ativa. Você responde pela decisão e pelo risco."
  ],
  nos: [
    no(
      "n1",
      "enfermagem",
      "",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
      [
        opcao(
          "Autoriza desativar a zona de detecção até o fim do dia, para a equipe trabalhar sem sobressaltos.",
          "autorizou desativar a zona de detecção",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Desativar a detecção de uma área com pacientes para ter sossego é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "A zona ficou sem proteção por horas, a brigada soube depois e a decisão virou registro de falha."
        ),
        opcao(
          "Mantém a detecção ativa, aciona o procedimento da instituição, avisa a brigada e a enfermagem e envia o técnico investigar a causa.",
          "manteve a detecção e acionou o procedimento",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
          "Falso alarme repetido pede investigação, e não desligamento: manter a proteção, avisar a brigada e investigar é a resposta firme.",
          "A proteção continuou ativa, a brigada ficou informada e o técnico começou a investigar com apoio."
        ),
        opcao(
          "Pede à equipe que ignore os próximos disparos, já que não houve fogo.",
          "mandou ignorar os próximos disparos",
          null,
          40,
          ["aplicacao-nr-pop", "comunicacao-cliente"],
          "Mandar ignorar disparos ensina a equipe a desconfiar do alarme justamente quando ele for verdadeiro.",
          "A equipe passou a demorar para reagir aos disparos, e a brigada percebeu o hábito se espalhar."
        )
      ],
      "Sem decisão sua, a equipe passou a ignorar os disparos por conta própria."
    ),
    no(
      "n2a",
      "tecnico",
      "O técnico encontra indícios de um detector com problema, mas a troca depende de uma peça que chega amanhã. A enfermagem pergunta como agir se disparar de novo.",
      "orientacao",
      ["gestao-os", "aplicacao-nr-pop", "comunicacao-cliente"],
      [
        opcao(
          "Pede à enfermagem que ligue para o técnico a cada disparo.",
          "pediu que a enfermagem ligasse a cada disparo",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Ter um contato é útil, mas a conduta diante de cada disparo é decisão combinada com a brigada.",
          "O técnico recebeu vários chamados, e a enfermagem reagiu de formas diferentes a cada disparo."
        ),
        opcao(
          "Define com a brigada e a enfermagem como tratar cada disparo até a troca, mantém o registro e informa quem ficou de plantão.",
          "combinou com a brigada como tratar cada disparo",
          "orientacao",
          100,
          ["aplicacao-nr-pop", "comunicacao-cliente", "gestao-os"],
          "Combinar com a brigada e a enfermagem como agir em cada disparo, com registro, protege a área enquanto a peça não chega.",
          "A equipe passou a reagir do mesmo jeito a cada disparo, e o plantão seguinte soube o combinado."
        ),
        opcao(
          "Diz que, com o detector identificado, o risco acabou.",
          "disse que o risco acabou",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Identificar a causa não elimina o risco enquanto a peça não é trocada: a conduta provisória é necessária.",
          "A equipe relaxou, e um novo disparo foi tratado com atraso."
        )
      ]
    ),
    no(
      "n2b",
      "seguranca-trabalho",
      "Os disparos continuaram, a enfermagem passou a ignorá-los e o responsável pela brigada soube pelos corredores. Ele quer saber quem decidiu o quê e se há risco real.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Explica ao responsável o que houve e deixa o reforço à enfermagem para o próximo turno.",
          "explicou à brigada e adiou o reforço",
          "orientacao",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Explicar é necessário, mas o reforço de que todo disparo é real não podia esperar o próximo turno.",
          "O responsável aceitou a explicação, mas houve outro disparo ignorado antes do reforço."
        ),
        opcao(
          "Diz que a causa é equipamento defeituoso e que isso não é assunto da brigada.",
          "disse que não era assunto da brigada",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A brigada responde pela segurança contra incêndio: deixá-la de fora esconde um risco que é também dela.",
          "A brigada reclamou à direção, e a relação entre manutenção e segurança esfriou."
        ),
        opcao(
          "Assume a explicação, reforça que todo disparo deve ser tratado como real, aciona o procedimento e registra o ocorrido.",
          "assumiu e reforçou que todo disparo é real",
          "direcao",
          100,
          ["decisao-pressao", "comunicacao-cliente", "aplicacao-nr-pop"],
          "Assumir, reforçar que todo disparo é real e registrar recompõe a cultura de segurança e a confiança da brigada.",
          "A equipe voltou a reagir aos disparos, e a brigada passou a ser informada de cada ocorrência."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. A direção assistencial pergunta se pode confiar no sistema de alarme esta noite e pede um posicionamento claro por escrito.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Diz que o sistema é confiável e que o assunto está resolvido.",
          "disse que o sistema era confiável",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Garantir confiabilidade com um detector ainda com problema promete o que não se controla.",
          "A noite trouxe outro disparo, e a promessa feita à direção assistencial perdeu valor."
        ),
        opcao(
          "Garante apoio da manutenção a qualquer hora, sem detalhar o plano.",
          "garantiu apoio sem detalhar o plano",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Apoio é bom, mas a direção assistencial pediu um plano por escrito e não só disponibilidade.",
          "A direção assistencial aceitou o apoio, mas voltou a cobrar o plano antes da troca de plantão."
        ),
        opcao(
          "Envia o que se sabe, o que ainda é incerto, como cada disparo será tratado e quem decide em caso de dúvida.",
          "enviou o que se sabe e como tratar cada disparo",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia", "aplicacao-nr-pop"],
          "Um posicionamento escrito, honesto sobre o que é incerto e com responsáveis definidos, dá à assistência o que ela precisa.",
          "A direção assistencial distribuiu o texto aos plantões, e a noite começou com todos orientados."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. A direção assistencial diz que a confiança no sistema de alarme caiu e quer saber se os pacientes estão protegidos esta noite.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Assume a falha, apresenta o que se sabe e define como cada disparo será tratado, quem decide e quando haverá atualização.",
          "assumiu a falha e definiu como tratar os disparos",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "aplicacao-nr-pop"],
          "Assumir a falha e definir conduta, responsável e horário de atualização recupera a confiança sem prometer o que não se controla.",
          "A direção assistencial aceitou o plano e passou a cobrar as atualizações no horário."
        ),
        opcao(
          "Apresenta o que se sabe, mas deixa a definição de como tratar os disparos para o dia seguinte.",
          "apresentou o que sabia e adiou a conduta",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Os fatos ajudam, mas a conduta diante dos disparos precisava estar definida antes da noite.",
          "A direção assistencial aceitou os fatos, mas pediu a conduta ainda antes do fim do plantão."
        ),
        opcao(
          "Sugere que a direção assistencial peça à brigada que acompanhe sozinha.",
          "sugeriu que a brigada acompanhasse sozinha",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A manutenção também responde pelo sistema: transferir o acompanhamento à brigada foge da responsabilidade.",
          "A brigada, sem apoio da manutenção, reclamou à direção."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "O fornecedor propõe trocar o detector durante a noite, sem avisar a brigada, para “não incomodar a internação”.",
      "direcao",
      ["aplicacao-nr-pop", "materiais-custos", "decisao-pressao"],
      [
        opcao(
          "Exige o aviso à brigada, combina com a enfermagem a janela do serviço e define a proteção alternativa durante a troca.",
          "exigiu aviso à brigada e proteção alternativa",
          "direcao",
          100,
          ["aplicacao-nr-pop", "comunicacao-cliente", "gestao-os"],
          "Trocar um detector sem avisar a brigada deixa a área desprotegida sem que ninguém saiba: aviso e proteção alternativa são essenciais.",
          "A troca ocorreu na janela combinada, com a brigada ciente e a área protegida."
        ),
        opcao(
          "Aceita, desde que o fornecedor seja discreto e rápido.",
          "aceitou a troca discreta sem avisar a brigada",
          "apoio",
          40,
          ["aplicacao-nr-pop", "delegacao"],
          "Discrição não substitui o aviso à brigada nem a proteção alternativa durante a troca.",
          "A troca foi rápida, mas a brigada soube depois e a área ficou desprotegida sem registro."
        ),
        opcao(
          "Aceita o horário, mas pede que a brigada seja avisada se houver tempo.",
          "aceitou o horário e condicionou o aviso ao tempo",
          "orientacao",
          70,
          ["aplicacao-nr-pop", "comunicacao-cliente"],
          "Pedir o aviso é correto, mas condicioná-lo ao tempo disponível o enfraquece.",
          "A brigada foi avisada só no meio do serviço, e a proteção alternativa não estava pronta."
        )
      ]
    ),
    no(
      "n4b",
      "seguranca-trabalho",
      "Com o dia cansativo, um funcionário sugere retirar um detector do teto para evitar novos disparos até a peça chegar, “só até amanhã”.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "contingencia"],
      [
        opcao(
          "Concorda, desde que o detector seja recolocado depois.",
          "concordou em retirar o detector provisoriamente",
          "apoio",
          40,
          ["aplicacao-nr-pop", "gestao-equipe"],
          "Retirar um detector, mesmo com promessa de recolocar, deixa a área sem proteção.",
          "O detector saiu, a recolocação foi esquecida e a área ficou desprotegida além do combinado."
        ),
        opcao(
          "Autoriza retirar o detector e deixa a decisão sobre o momento de recolocá-lo com a equipe.",
          "autorizou retirar o detector",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Autorizar retirar um detector, num setor com pacientes, e largar o momento de recolocar é o oposto do esperado. Gera alerta vermelho.",
          "A área ficou sem detecção por mais tempo do que o previsto, e o episódio virou registro de falha."
        ),
        opcao(
          "Proíbe retirar o detector, explica o motivo e aciona a proteção alternativa combinada com a brigada.",
          "proibiu retirar o detector e acionou proteção alternativa",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "contingencia"],
          "Sob cansaço e pressão, a proteção da área não se negocia: proibir, explicar e acionar a alternativa é a decisão firme.",
          "O funcionário entendeu o motivo, a proteção alternativa entrou em ação e a brigada reforçou a vigilância."
        )
      ],
      "Sem decisão sua, o detector foi retirado por conta própria e ninguém registrou."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. O detector foi trocado e o sistema está estável. A direção quer saber o que aconteceu e como evitar que alarmes sejam ignorados.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
      [
        opcao(
          "Relata os fatos e agradece à brigada e à enfermagem.",
          "relatou os fatos e agradeceu às equipes",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e agradecer é bom, mas faltou transformar o aprendizado em melhoria concreta.",
          "A direção aceitou o relato e perguntou, na semana seguinte, o que tinha mudado."
        ),
        opcao(
          "Diz que foi só um detector defeituoso e que não há o que mudar.",
          "disse que foi só um detector defeituoso",
          null,
          40,
          ["comunicacao-cliente"],
          "Reduzir o episódio a um defeito esconde a perda de confiança no alarme que a equipe viveu.",
          "A equipe seguiu desconfiando dos alarmes, e o problema voltou a aparecer."
        ),
        opcao(
          "Relata com a linha do tempo, reconhece a brigada e propõe orientar a equipe a tratar todo disparo como real, com dono e prazo.",
          "relatou, reconheceu a brigada e propôs orientação",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Relato claro, reconhecimento da brigada e uma ação concreta com dono e prazo previnem que alarmes sejam ignorados.",
          "A direção aprovou a orientação, e a equipe passou a tratar cada disparo com seriedade."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. O sistema segue instável, parte da equipe já ignora os alarmes e a direção exige explicação. Há receio de que o problema se repita à noite.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume a falha de coordenação, expõe a linha do tempo, ouve brigada e enfermagem e apresenta um plano com dono e data.",
          "assumiu a falha e apresentou plano com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir as equipes e apresentar plano com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o plano, e as equipes sentiram que o erro foi tratado sem procurar culpados."
        ),
        opcao(
          "Culpa a enfermagem por ignorar os alarmes.",
          "culpou a enfermagem por ignorar os alarmes",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar a enfermagem esconde a falha de coordenação que levou o alarme a perder credibilidade.",
          "A enfermagem se sentiu exposta, e a cooperação com a manutenção diminuiu."
        ),
        opcao(
          "Assume parte da falha e promete reforçar a orientação em breve.",
          "assumiu parte da falha e prometeu reforço",
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
