// Cenário: autoclaves e Central de Material e Esterilização (CME). CONTEÚDO DEMONSTRATIVO (pendente
// de validação técnica e pedagógica). Nível gerencial: nada aqui descreve ciclos, parâmetros nem
// como validar um processo de esterilização; isso é da RDC 15/2012, do procedimento da CME e do
// fabricante.
import { no, opcao, pacote } from "../construtor.js";

export const autoclavesCme = pacote({
  categoria: {
    id: "autoclaves-cme",
    nome: "Autoclaves e CME",
    descricao: "Autoclaves, esterilização e a Central de Material e Esterilização.",
    palavrasFortes: [
      "autoclave",
      "esterilizacao",
      "cme",
      "central de material",
      "central de esterilizacao",
      "esterilizar",
      "material esterilizado",
      "instrumental cirurgico"
    ],
    palavrasFracas: ["vapor", "instrumental", "ciclo", "lote", "cirurgia"],
    exemplos: [
      "A autoclave da CME parou e há cirurgias agendadas.",
      "Um ciclo de esterilização foi reprovado e o material está retido."
    ]
  },
  titulo: "Autoclave da CME parada com cirurgias na agenda",
  fontes: ["anvisa-rdc-15-2012", "nhs-htm-01-01", "anvisa-rdc-63-2011", "cdc-controle-ambiental"],
  aberturas: [
    "Início do turno. A autoclave principal da CME parou e a equipe teme faltar instrumental para as cirurgias da manhã. Há pressão para liberar material sem a conferência completa. Você lidera o turno.",
    "A autoclave principal da CME parou, as cirurgias da manhã dependem do instrumental e a chefia da CME pede soluções rápidas. Há quem sugira liberar material sem a conferência completa. Você decide prioridades e comunicação.",
    "A autoclave principal da CME parou e o centro cirúrgico pode atrasar a agenda. O contrato exige processo seguro e a direção quer uma solução hoje. Você responde pelo equilíbrio entre prazo e segurança."
  ],
  nos: [
    no(
      "n1",
      "controle-infeccao",
      "",
      "direcao",
      ["aplicacao-nr-pop", "contingencia", "comunicacao-cliente"],
      [
        opcao(
          "Informa a chefia da CME e o centro cirúrgico, mantém a conferência completa do processo e aciona o plano de contingência e o reparo urgente.",
          "informou todos, manteve o processo e chamou o reparo",
          "direcao",
          100,
          ["aplicacao-nr-pop", "contingencia", "comunicacao-cliente"],
          "Com a autoclave parada, avisar quem depende do material, manter o processo íntegro e acionar a contingência vem antes de qualquer atalho.",
          "O centro cirúrgico soube cedo, ajustou a agenda e o reparo foi tratado como urgente."
        ),
        opcao(
          "Deixa a CME liberar o material sem a conferência completa, para não atrasar as cirurgias.",
          "deixou liberar o material sem conferência completa",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Liberar material sem a conferência completa, para cumprir a agenda, é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "O controle de infecção percebeu o desvio, o material precisou ser recolhido e a ocorrência foi formalizada."
        ),
        opcao(
          "Pede ao técnico que arrume rápido, sem avisar o centro cirúrgico, para evitar alarme.",
          "pediu reparo rápido sem avisar o centro cirúrgico",
          null,
          40,
          ["gestao-os", "comunicacao-cliente"],
          "Esconder a parada para evitar alarme tira do centro cirúrgico a chance de se preparar.",
          "A autoclave não voltou a tempo, e o centro cirúrgico soube do problema quando faltou material."
        )
      ],
      "Sem decisão sua, a CME ficou sem orientação e a pressão por liberar material cresceu."
    ),
    no(
      "n2a",
      "enfermagem",
      "Com o processo mantido, a chefia da CME pergunta como priorizar o instrumental disponível e se pode usar outra unidade. O centro cirúrgico quer a lista do que ficará pronto.",
      "orientacao",
      ["gestao-os", "contingencia", "comunicacao-cliente"],
      [
        opcao(
          "Pede que a chefia da CME decida sozinha a prioridade, com o apoio que precisar.",
          "deixou a chefia da CME decidir a prioridade",
          "apoio",
          70,
          ["delegacao", "gestao-os"],
          "Apoiar a chefia da CME é bom, mas a prioridade das cirurgias deve ser combinada com o centro cirúrgico.",
          "A CME priorizou com os critérios que tinha, e o centro cirúrgico discordou de parte da ordem."
        ),
        opcao(
          "Pede à CME que processe tudo sem priorizar, para ninguém reclamar.",
          "mandou processar tudo sem priorizar",
          null,
          40,
          ["gestao-os", "decisao-pressao"],
          "Não priorizar para evitar queixas ignora que o instrumental disponível tem destino mais urgente.",
          "Tudo foi processado sem ordem, e o instrumental da primeira cirurgia ficou para o fim."
        ),
        opcao(
          "Combina com a chefia da CME e o centro cirúrgico uma prioridade por urgência clínica e uma lista do que ficará pronto e quando.",
          "combinou prioridade clínica e lista do que ficará pronto",
          "orientacao",
          100,
          ["gestao-os", "contingencia", "comunicacao-cliente"],
          "Priorizar por urgência clínica, com a CME e o centro cirúrgico, e divulgar o que ficará pronto dá previsibilidade.",
          "O centro cirúrgico reorganizou a agenda com base na lista, e a CME trabalhou com clareza."
        )
      ]
    ),
    no(
      "n2b",
      "controle-infeccao",
      "O material foi liberado sem a conferência completa e a enfermeira do controle de infecção percebeu. Ela quer saber quem autorizou, e a CME pede orientação sobre o que já saiu.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
      [
        opcao(
          "Assume a decisão, manda recolher e reavaliar o material liberado, informa o centro cirúrgico e registra o ocorrido.",
          "assumiu, mandou recolher e registrou",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
          "Diante de um desvio, assumir, recolher, avisar o centro cirúrgico e registrar corrige o erro e protege os pacientes.",
          "O material foi recolhido antes do uso, o centro cirúrgico foi avisado e o desvio ficou registrado."
        ),
        opcao(
          "Diz que o material já foi usado e que não adianta remexer no assunto.",
          "disse que não adiantava remexer no assunto",
          null,
          40,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Encerrar o assunto sem tratar o desvio deixa o risco ativo e impede qualquer aprendizado.",
          "O controle de infecção levou o caso adiante, e a falta de resposta virou outro problema."
        ),
        opcao(
          "Pede que a CME reavalie o material com calma, sem recolher nada ainda.",
          "pediu reavaliação sem recolher o material",
          "orientacao",
          70,
          ["aplicacao-nr-pop", "gestao-equipe"],
          "Reavaliar é necessário, mas sem recolher o material o risco continua em circulação.",
          "A reavaliação começou, mas parte do material seguiu para o centro cirúrgico antes de ser conferida."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da manhã. O centro cirúrgico pergunta se as cirurgias seguem no horário e quer saber, com clareza, o que depende do processo da CME.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Diz que a CME está fazendo o possível e que o centro cirúrgico confie.",
          "pediu confiança ao centro cirúrgico",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Pedir confiança acolhe, mas o centro cirúrgico precisa de informação para decidir.",
          "O centro cirúrgico aceitou, mas voltou a pedir os horários antes de iniciar a primeira cirurgia."
        ),
        opcao(
          "Informa o que está pronto, o que depende do processo, quando haverá nova posição e o que será priorizado.",
          "informou o pronto, o pendente e a nova posição",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Separar o que está pronto do que depende do processo e marcar nova posição permite ao centro cirúrgico decidir.",
          "O centro cirúrgico decidiu com base em fatos e usou a nova posição para ajustar o resto do dia."
        ),
        opcao(
          "Diz que o prazo é problema da CME e que o centro cirúrgico cobre diretamente.",
          "disse que o prazo era problema da CME",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Quem coordena não pode transferir a conversa à CME: a comunicação com o cliente é sua.",
          "A CME, sob pressão direta, recebeu cobranças diferentes e se sentiu desamparada."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da manhã. O centro cirúrgico exige saber por que o material chegou diferente do combinado e se as cirurgias estão em risco.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Explica o ocorrido e promete nova posição quando tiver informação.",
          "explicou o ocorrido e prometeu nova posição",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Explicar ajuda, mas sem horário e sem decisão sobre a prioridade o centro cirúrgico fica à espera.",
          "O centro cirúrgico aceitou a explicação, mas cobrou uma decisão antes da primeira cirurgia."
        ),
        opcao(
          "Diz que o problema foi só de comunicação interna da CME.",
          "disse que foi só comunicação interna da CME",
          null,
          40,
          ["comunicacao-cliente"],
          "Reduzir o problema a uma questão interna esconde o que o centro cirúrgico precisa saber.",
          "O centro cirúrgico percebeu a omissão e passou a desconfiar das próximas informações."
        ),
        opcao(
          "Assume o que falhou, informa o que foi recolhido e reavaliado e define com ele a prioridade das cirurgias.",
          "assumiu a falha e definiu a prioridade das cirurgias",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "aplicacao-nr-pop"],
          "Assumir a falha, dizer o que foi recolhido e definir a prioridade juntos recupera a confiança do centro cirúrgico.",
          "O centro cirúrgico aceitou a prioridade, e a confiança na CME foi retomada aos poucos."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "O fornecedor oferece uma solução provisória para a autoclave, mas pede que a CME retome o uso antes de a validação do processo estar concluída.",
      "direcao",
      ["materiais-custos", "aplicacao-nr-pop", "decisao-pressao"],
      [
        opcao(
          "Aceita a solução provisória, já que o fornecedor sabe o que faz.",
          "aceitou o uso antes da validação",
          "apoio",
          40,
          ["materiais-custos", "aplicacao-nr-pop"],
          "Confiar no fornecedor não dispensa a validação do processo antes de usar a unidade.",
          "A unidade voltou ao uso, e a falta de validação foi apontada como desvio na revisão."
        ),
        opcao(
          "Mantém a CME sem usar a unidade até a validação do processo e combina com o fornecedor o prazo e o registro.",
          "esperou a validação e combinou prazo e registro",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "materiais-custos"],
          "Esperar a validação, mesmo com pressa, e combinar prazo e registro mantém o processo íntegro.",
          "O fornecedor concluiu a validação no prazo combinado, e o uso foi retomado com registro."
        ),
        opcao(
          "Pede que o fornecedor antecipe a validação e deixa o uso da unidade para o dia seguinte, sem decidir com o centro cirúrgico.",
          "pediu antecipar a validação e adiou a decisão",
          "orientacao",
          70,
          ["materiais-custos", "gestao-os"],
          "Pedir pressa à validação é bom, mas o uso da unidade afeta o centro cirúrgico e deveria ser combinado com ele.",
          "A validação foi antecipada, porém o centro cirúrgico descobriu o novo prazo tarde."
        )
      ]
    ),
    no(
      "n4b",
      "tecnico",
      "A pressão da manhã faz uma técnica da CME sugerir abreviar a conferência do material, “só desta vez”, para a primeira cirurgia sair no horário.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
      [
        opcao(
          "Recusa abreviar a conferência, explica o motivo à técnica e aciona a alternativa combinada com o centro cirúrgico.",
          "recusou abreviar a conferência e acionou a alternativa",
          "direcao",
          100,
          ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
          "Sob pressão, a conferência não se abrevia: recusar, explicar o motivo e acionar a alternativa protege pacientes e equipe.",
          "A técnica entendeu o motivo, a alternativa foi acionada e a primeira cirurgia atrasou pouco."
        ),
        opcao(
          "Diz que ela é experiente e que decide o melhor para o momento.",
          "deixou a técnica decidir a conferência",
          "delegacao",
          40,
          ["delegacao", "aplicacao-nr-pop"],
          "A conferência do material não é decisão pessoal da técnica, por mais experiente que seja.",
          "A técnica abreviou parte da conferência por conta própria, e o desvio ficou sem registro."
        ),
        opcao(
          "Autoriza abreviar a conferência desta vez, para a primeira cirurgia sair no horário.",
          "autorizou abreviar a conferência desta vez",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Autorizar abreviar a conferência para cumprir o horário é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "O desvio foi percebido pelo controle de infecção, o material foi retido e a ocorrência foi formalizada."
        )
      ],
      "Sem decisão sua, a técnica abreviou a conferência por conta própria e o desvio ficou sem registro."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. A CME normalizou o processo e as cirurgias foram feitas. A direção quer um relato do que aconteceu e o que muda para a próxima parada.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
      [
        opcao(
          "Relata com a linha do tempo, reconhece a equipe da CME e propõe um plano de contingência combinado com o centro cirúrgico, com dono e prazo.",
          "relatou, reconheceu a CME e propôs contingência",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "contingencia"],
          "Relatar com fatos, reconhecer a CME e propor uma contingência com dono e prazo fecha o ciclo e previne repetição.",
          "A direção aprovou a contingência, e o centro cirúrgico passou a participar do plano."
        ),
        opcao(
          "Diz que o dia foi corrido, mas que no fim deu tudo certo.",
          "disse que no fim deu tudo certo",
          null,
          40,
          ["comunicacao-cliente"],
          "Resumir o dia a um final feliz desperdiça o aprendizado sobre o que quase deu errado.",
          "A direção aceitou, e a pressão por liberar material voltou a aparecer na próxima parada."
        ),
        opcao(
          "Relata os fatos e elogia a equipe, sem propor ajuste.",
          "relatou os fatos e elogiou a equipe",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e elogiar é bom, mas faltou transformar a experiência em melhoria concreta.",
          "A direção aceitou o relato e perguntou, na semana seguinte, o que tinha mudado."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. Houve atraso nas cirurgias e questionamento sobre o processo da CME. A direção exige explicação, e a equipe teme ser responsabilizada.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume parte da falha e promete revisar a comunicação com o centro cirúrgico.",
          "assumiu parte da falha e prometeu revisar",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
          "A direção valorizou a franqueza e pediu um plano concreto para a semana seguinte."
        ),
        opcao(
          "Diz que a equipe da CME foi quem falhou na priorização.",
          "culpou a equipe da CME pela priorização",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar a equipe esconde a falha de coordenação e afasta quem poderia ajudar a corrigir.",
          "A equipe da CME se sentiu exposta e passou a esconder pequenos problemas."
        ),
        opcao(
          "Assume a falha de coordenação, relata a linha do tempo, ouve a CME e propõe plano de contingência com dono e data.",
          "assumiu a falha e propôs contingência com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "contingencia"],
          "Assumir a falha, ouvir a CME e propor contingência com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o plano, e a CME sentiu que o erro foi tratado sem procurar culpados."
        )
      ]
    )
  ]
});
