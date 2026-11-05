// Cenário: refrigeradores e câmaras de vacinas e medicamentos (cadeia de frio). CONTEÚDO
// DEMONSTRATIVO (pendente de validação técnica e pedagógica). Nível gerencial: não traz faixa de
// temperatura nem critério de descarte; isso é da vigilância, do fabricante e da farmácia.
import { no, opcao, pacote } from "../construtor.js";

export const refrigeracaoCadeiaFrio = pacote({
  categoria: {
    id: "refrigeracao-cadeia-frio",
    nome: "Refrigeradores e câmaras de vacinas e medicamentos",
    descricao:
      "Câmaras frias, geladeiras de vacinas e de medicamentos refrigerados e seus alarmes.",
    palavrasFortes: [
      "camara fria",
      "camara de vacinas",
      "geladeira de vacinas",
      "vacinas",
      "vacina",
      "cadeia de frio",
      "refrigerador",
      "medicamentos refrigerados"
    ],
    palavrasFracas: ["temperatura", "geladeira", "farmacia", "freezer", "alarme"],
    exemplos: [
      "O alarme de temperatura da geladeira de vacinas disparou.",
      "A câmara fria da farmácia parou durante a noite."
    ]
  },
  titulo: "Alarme de temperatura na câmara de vacinas",
  fontes: ["cdc-vacinas", "anvisa-rdc-63-2011", "oms-programas"],
  aberturas: [
    "Início do turno. O alarme de temperatura da câmara de vacinas disparou e a técnica de enfermagem pergunta o que fazer com o conteúdo. O técnico quer ajustar o equipamento primeiro. Você lidera o turno.",
    "O alarme de temperatura da câmara de vacinas disparou. A enfermagem quer saber o destino do conteúdo, o técnico quer ajustar o equipamento e a farmácia ainda não foi avisada. Você decide a prioridade e a comunicação.",
    "O alarme da câmara de vacinas e medicamentos refrigerados disparou durante a noite e a direção quer saber o risco ao estoque. A farmácia e a vigilância têm regras próprias de comunicação. Você responde pela decisão e pelo registro."
  ],
  nos: [
    no(
      "n1",
      "enfermagem",
      "",
      "direcao",
      ["contingencia", "comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Isola o conteúdo conforme o procedimento da instituição, avisa a farmácia e a responsável técnica e registra o alarme antes de qualquer ajuste.",
          "isolou o conteúdo, avisou a farmácia e registrou",
          "direcao",
          100,
          ["contingencia", "comunicacao-cliente", "aplicacao-nr-pop"],
          "Diante de alarme de temperatura, proteger o conteúdo, avisar quem responde por ele e registrar vem antes de ajustar o equipamento.",
          "O conteúdo ficou protegido, a farmácia assumiu a avaliação e o alarme ficou registrado."
        ),
        opcao(
          "Deixa o técnico ajustar o equipamento e depois decide o que fazer com o conteúdo.",
          "deixou ajustar o equipamento antes de decidir",
          "delegacao",
          40,
          ["delegacao", "contingencia"],
          "Ajustar o equipamento antes de proteger o conteúdo e avisar a farmácia inverte a ordem de prioridade.",
          "O equipamento foi ajustado, mas o conteúdo ficou sem decisão e a farmácia soube depois."
        ),
        opcao(
          "Avisa a farmácia e segura o conteúdo, mas deixa o registro do alarme para o fim do turno.",
          "avisou a farmácia e adiou o registro do alarme",
          "orientacao",
          70,
          ["contingencia", "comunicacao-cliente"],
          "Avisar e segurar o conteúdo é correto, mas o registro do alarme deveria ser imediato.",
          "A farmácia avaliou o conteúdo, e a falta de registro atrasou a conclusão sobre a causa."
        )
      ],
      "Sem decisão sua, o conteúdo ficou sem destino e o alarme sem registro."
    ),
    no(
      "n2a",
      "responsavel-assistencial",
      "A farmácia confirma que o procedimento está em curso, mas pede que a manutenção informe a causa e por quanto tempo o equipamento esteve fora do esperado, para decidir sobre o conteúdo.",
      "orientacao",
      ["aplicacao-nr-pop", "contingencia", "comunicacao-cliente"],
      [
        opcao(
          "Pede ao técnico que informe à farmácia o que descobrir.",
          "pediu ao técnico que informasse à farmácia",
          "apoio",
          70,
          ["delegacao", "comunicacao-cliente"],
          "Pedir ao técnico ajuda, mas o fluxo de informação precisa de alguém que feche o relato e o horário.",
          "A farmácia recebeu informações em pedaços e precisou pedir esclarecimentos duas vezes."
        ),
        opcao(
          "Organiza o fluxo de informação: o técnico apura a causa, o registro é fechado e a farmácia recebe um relato único dentro de um horário combinado.",
          "organizou o fluxo e entregou um relato único",
          "orientacao",
          100,
          ["comunicacao-cliente", "aplicacao-nr-pop", "gestao-equipe"],
          "Um relato único, num horário combinado, sustenta a decisão da farmácia sobre o conteúdo e deixa tudo registrado.",
          "A farmácia decidiu no horário combinado, com um relato claro e registrado."
        ),
        opcao(
          "Diz que a decisão sobre o conteúdo é da farmácia e se afasta.",
          "afastou-se da decisão sobre o conteúdo",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A decisão do conteúdo é da farmácia, mas a informação sobre o equipamento é de quem coordena a manutenção.",
          "A farmácia ficou sem dados sobre o equipamento e adiou a decisão sobre o conteúdo."
        )
      ]
    ),
    no(
      "n2b",
      "responsavel-assistencial",
      "O técnico ajustou o equipamento e o conteúdo foi usado como se nada tivesse acontecido. A farmácia soube do alarme depois e quer saber quem decidiu e o que já foi usado.",
      "direcao",
      ["decisao-pressao", "aplicacao-nr-pop", "comunicacao-cliente"],
      [
        opcao(
          "Assume a decisão, manda suspender o uso do que resta, informa a farmácia e a responsável técnica e registra o ocorrido.",
          "assumiu, suspendeu o uso do restante e registrou",
          "direcao",
          100,
          ["decisao-pressao", "aplicacao-nr-pop", "comunicacao-cliente"],
          "Quando o uso já ocorreu sem avaliação, assumir, suspender o restante, informar e registrar corrige o rumo.",
          "O uso do restante foi suspenso, a farmácia assumiu a avaliação e o ocorrido ficou registrado."
        ),
        opcao(
          "Diz que o equipamento voltou ao normal e que não vale a pena criar alarme.",
          "disse que não valia a pena criar alarme",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Minimizar o episódio esconde da farmácia o que ela precisa para avaliar o que foi usado.",
          "A farmácia soube de tudo por outras vias, e a confiança na manutenção caiu."
        ),
        opcao(
          "Explica o que houve à farmácia e deixa que ela decida sozinha sobre o conteúdo restante.",
          "explicou à farmácia e deixou a decisão com ela",
          "orientacao",
          70,
          ["comunicacao-cliente", "aplicacao-nr-pop"],
          "Explicar é necessário, mas faltou suspender o uso do restante e registrar enquanto a farmácia avalia.",
          "A farmácia avaliou, mas parte do restante foi usado antes da conclusão."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. A farmácia pergunta qual será o destino do conteúdo e pede um relatório claro do ocorrido para a responsável técnica.",
      "orientacao",
      ["comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Diz que o conteúdo está bom e que a farmácia não precisa se preocupar.",
          "disse que o conteúdo estava bom",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Quem coordena a manutenção não decide sobre o conteúdo: afirmar que está bom invade a competência da farmácia.",
          "A farmácia desconsiderou a afirmação e fez a avaliação própria, atrasando o relatório."
        ),
        opcao(
          "Promete o relatório para o fim do dia e pede confiança.",
          "prometeu o relatório para o fim do dia",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Prometer o relatório ajuda, mas a responsável técnica precisava de um relato claro já.",
          "A farmácia esperou o relatório e adiou a decisão sobre o conteúdo."
        ),
        opcao(
          "Envia o relatório com o que se sabe, o que está em avaliação e quem decide o destino do conteúdo.",
          "enviou relatório com o que se sabe e quem decide",
          "orientacao",
          100,
          ["comunicacao-cliente", "aplicacao-nr-pop"],
          "Um relatório claro, honesto sobre o que está em avaliação e com o responsável pela decisão, dá à farmácia o que ela precisa.",
          "A responsável técnica usou o relatório para decidir e agradeceu a clareza."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. A farmácia reclama de ter sido avisada tarde e exige um relatório claro do ocorrido e do conteúdo já utilizado.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Assume o aviso tardio, entrega o que se sabe sobre o uso do conteúdo e define quem decide o destino do restante.",
          "assumiu o aviso tardio e definiu quem decide",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "aplicacao-nr-pop"],
          "Assumir o aviso tardio, entregar o que se sabe e definir quem decide recupera a confiança da farmácia.",
          "A farmácia aceitou o combinado e passou a tratar a manutenção como parceira."
        ),
        opcao(
          "Entrega o relatório, mas deixa a decisão sobre o destino do restante em aberto.",
          "entregou o relatório e deixou a decisão em aberto",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "O relatório ajuda, mas a decisão sobre o restante precisava de um responsável definido.",
          "A farmácia recebeu o relatório e cobrou a definição de quem decidiria o destino do restante."
        ),
        opcao(
          "Diz que a responsabilidade pelo uso do conteúdo foi da enfermagem.",
          "disse que o uso do conteúdo foi da enfermagem",
          null,
          40,
          ["comunicacao-cliente", "gestao-equipe"],
          "Atribuir à enfermagem o que nasceu da falta de aviso esconde a falha de comunicação.",
          "A enfermagem se sentiu exposta, e a farmácia passou a desconfiar da manutenção."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "A empresa de manutenção propõe um conserto rápido, sem o registro formal do serviço, para “não complicar a papelada da farmácia”.",
      "direcao",
      ["aplicacao-nr-pop", "materiais-custos", "decisao-pressao"],
      [
        opcao(
          "Aceita o conserto e pede o registro depois do serviço.",
          "aceitou o conserto e adiou o registro",
          "orientacao",
          70,
          ["aplicacao-nr-pop", "materiais-custos"],
          "Pedir o registro depois é melhor que nada, mas o serviço precisava ser registrado e acompanhado desde o início.",
          "O conserto foi feito e o registro veio incompleto, o que atrasou a liberação do equipamento."
        ),
        opcao(
          "Aceita a proposta, por confiar na empresa e para aliviar a farmácia.",
          "aceitou o conserto sem registro formal",
          "apoio",
          40,
          ["aplicacao-nr-pop", "delegacao"],
          "Confiança na empresa não substitui o registro formal: sem ele, a farmácia não consegue sustentar a decisão sobre o conteúdo.",
          "O serviço ficou sem registro, e a farmácia não pôde liberar o conteúdo de volta."
        ),
        opcao(
          "Exige o registro formal do serviço, combina o acompanhamento da farmácia e a confirmação do equipamento antes de recolocar o conteúdo.",
          "exigiu registro e confirmação antes de recolocar o conteúdo",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
          "Registro formal, acompanhamento da farmácia e confirmação do equipamento antes de recolocar o conteúdo mantêm a cadeia protegida.",
          "O serviço foi registrado e acompanhado, e a farmácia recolocou o conteúdo com segurança."
        )
      ]
    ),
    no(
      "n4b",
      "tecnico",
      "A farmácia está pressionada por estoque e uma técnica sugere devolver ao uso parte do conteúdo “que parece normal”, sem a avaliação da responsável técnica.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "gestao-equipe"],
      [
        opcao(
          "Recusa devolver ao uso, explica o motivo à técnica e aguarda a avaliação da responsável técnica.",
          "recusou devolver ao uso e aguardou a avaliação",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "gestao-equipe"],
          "Aparência normal não decide o destino do conteúdo: recusar, explicar e aguardar a responsável técnica protege os pacientes.",
          "A técnica entendeu o motivo, a avaliação foi feita e o conteúdo só voltou ao uso com decisão formal."
        ),
        opcao(
          "Autoriza devolver ao uso o que parece normal, para evitar desperdício.",
          "autorizou devolver ao uso o que parecia normal",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Devolver ao uso conteúdo sem avaliação da responsável técnica, para evitar desperdício, é o oposto do esperado. Gera alerta vermelho.",
          "A responsável técnica recolheu o que foi devolvido, a vigilância foi informada e a decisão virou registro de falha."
        ),
        opcao(
          "Pede que a técnica use o bom senso e decida o que devolver.",
          "deixou a técnica decidir o que devolver",
          "apoio",
          40,
          ["delegacao", "aplicacao-nr-pop"],
          "Decidir o destino do conteúdo não é questão de bom senso individual: é da responsável técnica.",
          "A técnica devolveu parte do conteúdo por conta própria, e o desvio foi apontado depois."
        )
      ],
      "Sem decisão sua, parte do conteúdo foi devolvida ao uso por conta própria."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. A situação foi esclarecida e o equipamento está confirmado. A direção quer um relato do que aconteceu e do que muda para o próximo alarme.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
      [
        opcao(
          "Diz que foi um alarme sem consequências e que não há o que mudar.",
          "disse que foi alarme sem consequências",
          null,
          40,
          ["comunicacao-cliente"],
          "Tratar como sem consequências o que mostrou um fluxo de aviso frágil desperdiça o aprendizado.",
          "O mesmo atraso de aviso voltou a acontecer no alarme seguinte."
        ),
        opcao(
          "Relata com a linha do tempo, reconhece farmácia e enfermagem e propõe um fluxo único de aviso do alarme, com dono e prazo.",
          "relatou, reconheceu as equipes e propôs fluxo único de aviso",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Relato claro, reconhecimento das equipes e um fluxo único de aviso com dono e prazo previnem a repetição.",
          "A direção aprovou o fluxo único, e os próximos alarmes foram tratados com agilidade."
        ),
        opcao(
          "Relata os fatos e agradece às equipes, sem propor ajuste.",
          "relatou os fatos e agradeceu às equipes",
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
      "Fim do dia. Parte do conteúdo foi descartada por dúvida, o estoque ficou apertado e a direção exige explicação. Farmácia e enfermagem divergem.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume parte da falha e promete revisar o aviso do alarme.",
          "assumiu parte da falha e prometeu revisar o aviso",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
          "A direção valorizou a franqueza e pediu um plano concreto para a semana seguinte."
        ),
        opcao(
          "Culpa a enfermagem e o técnico pelo descarte.",
          "culpou a enfermagem e o técnico pelo descarte",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar as equipes esconde a falha de coordenação e afasta quem poderia ajudar a corrigir.",
          "As equipes se sentiram expostas, e a cooperação com a farmácia diminuiu."
        ),
        opcao(
          "Assume a falha de coordenação, relata a linha do tempo, ouve farmácia e enfermagem e propõe fluxo de aviso com dono e data.",
          "assumiu a falha e propôs fluxo de aviso com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir as equipes e propor um fluxo de aviso com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o fluxo, e as equipes sentiram que o erro foi tratado sem procurar culpados."
        )
      ]
    )
  ]
});
