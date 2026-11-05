// Cenário: quadros e instalações elétricas. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e
// pedagógica). Nível gerencial: a NR-10 e o procedimento do Grand Massif prevalecem sempre; nada
// aqui descreve como executar um serviço elétrico.
import { no, opcao, pacote } from "../construtor.js";

export const quadrosEletricos = pacote({
  categoria: {
    id: "quadros-eletricos",
    nome: "Quadros e instalações elétricas",
    descricao: "Quadros de distribuição, disjuntores e serviços em instalações elétricas.",
    palavrasFortes: [
      "quadro eletrico",
      "disjuntor",
      "painel eletrico",
      "nr 10",
      "eletricista",
      "choque",
      "curto circuito",
      "religar"
    ],
    palavrasFracas: ["energia", "eletrico", "eletrica", "luz", "tomada", "cheiro"],
    exemplos: [
      "Um quadro elétrico do setor desarmou duas vezes e há cheiro de queimado.",
      "O eletricista terceirizado quer religar o painel sem o bloqueio."
    ]
  },
  titulo: "Quadro elétrico desarmando no setor de imagem",
  fontes: ["nr-10", "nhs-htm-06-01", "anvisa-rdc-63-2011", "oms-programas"],
  aberturas: [
    "Início do turno. Um quadro elétrico do setor de imagem desarmou duas vezes e há um cheiro estranho perto dele. A equipe quer religar “só para testar”. Você lidera o turno. Qual é o primeiro passo?",
    "Um quadro elétrico do setor de imagem desarmou duas vezes e há um cheiro estranho perto dele. Há exames agendados, um eletricista terceirizado disponível e a sua equipe pressiona para religar. Você decide a prioridade e o que comunicar.",
    "Um quadro elétrico crítico do setor de imagem desarmou duas vezes e o setor quer manter os exames do dia. Há um terceirizado disponível e um prazo contratual de atendimento. Você responde pela decisão e pelo risco."
  ],
  nos: [
    no(
      "n1",
      "tecnico",
      "",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "gestao-os"],
      [
        opcao(
          "Autoriza a equipe a religar uma vez, para ver se o problema se repete.",
          "autorizou religar uma vez para testar",
          "delegacao",
          40,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Religar para testar, com cheiro estranho, aposta contra o sinal de risco em vez de tratá-lo.",
          "O quadro desarmou de novo e o cheiro piorou, e a equipe passou a discutir quem tinha decidido."
        ),
        opcao(
          "Manda isolar a área, impede o religamento, aciona o procedimento de segurança elétrica e informa o setor sobre o impacto nos exames.",
          "isolou a área e acionou o procedimento",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
          "Diante de sinal de risco elétrico, isolar, seguir o procedimento e avisar o setor vem antes de qualquer teste.",
          "A área ficou segura, o setor soube do impacto nos exames e a equipe viu que a decisão era firme."
        ),
        opcao(
          "Pede que ninguém mexa no quadro e aguarda o eletricista terceirizado, sem avisar o setor ainda.",
          "mandou esperar o terceirizado sem avisar o setor",
          "orientacao",
          70,
          ["aplicacao-nr-pop", "gestao-os"],
          "Não mexer é correto, mas o setor precisava saber já do impacto nos exames.",
          "O quadro não foi tocado, mas o setor descobriu o problema pelos pacientes na fila."
        )
      ],
      "Sem decisão sua, a equipe religou o quadro por conta própria e ele desarmou de novo."
    ),
    no(
      "n2a",
      "seguranca-trabalho",
      "A área está isolada. O setor pergunta se os exames do dia seguem, e o terceirizado chega dizendo que resolve rápido, mas pede a liberação imediata do acesso.",
      "orientacao",
      ["aplicacao-nr-pop", "comunicacao-cliente", "gestao-os"],
      [
        opcao(
          "Confere a autorização e as exigências de segurança do terceirizado antes de liberar e combina com o setor quais exames podem seguir.",
          "conferiu a autorização antes de liberar o acesso",
          "orientacao",
          100,
          ["aplicacao-nr-pop", "comunicacao-cliente", "gestao-os"],
          "Conferir a autorização antes de liberar o acesso e alinhar os exames com o setor une segurança e continuidade.",
          "O terceirizado trabalhou com as exigências cumpridas, e o setor soube quais exames seguiam."
        ),
        opcao(
          "Libera o acesso imediatamente, para o setor voltar logo ao normal.",
          "liberou o acesso imediatamente",
          null,
          40,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Liberar sem conferir a autorização cede à pressa e abre mão do controle de quem entra na área.",
          "O serviço andou rápido, mas ficou sem registro de quem entrou e com que exigências."
        ),
        opcao(
          "Libera o acesso e confia que o terceirizado conhece as exigências.",
          "liberou confiando no terceirizado",
          "apoio",
          70,
          ["aplicacao-nr-pop", "delegacao"],
          "Confiar é razoável, mas a conferência das exigências é responsabilidade de quem libera a área.",
          "O serviço correu bem, porém uma exigência de registro foi esquecida e apareceu na revisão."
        )
      ]
    ),
    no(
      "n2b",
      "supervisor",
      "Sem plano, a equipe religou o quadro por conta própria e ele desarmou de novo. O setor de imagem cobra, e o técnico mais novo admite que teve medo de contrariar a equipe.",
      "direcao",
      ["decisao-pressao", "aplicacao-nr-pop", "gestao-equipe"],
      [
        opcao(
          "Reúne a equipe, explica o risco do religamento e combina o que será feito dali em diante.",
          "reuniu a equipe e explicou o risco",
          "orientacao",
          70,
          ["gestao-equipe", "aplicacao-nr-pop"],
          "Explicar o risco ajuda, mas antes disso a área precisava ser isolada e a ocorrência registrada.",
          "A equipe entendeu o risco, mas o quadro continuou acessível por mais alguns minutos."
        ),
        opcao(
          "Para tudo, isola a área, registra o ocorrido, aciona o procedimento de segurança e comunica o setor e a chefia.",
          "parou tudo, isolou a área e registrou",
          "direcao",
          100,
          ["decisao-pressao", "aplicacao-nr-pop", "comunicacao-cliente"],
          "Quando a situação saiu do controle, a resposta certa é parar, isolar, registrar e comunicar.",
          "A área ficou segura e todos souberam quem decidia. O técnico mais novo respirou aliviado."
        ),
        opcao(
          "Acolhe o técnico mais novo e deixa a equipe decidir como seguir.",
          "acolheu o técnico e deixou a equipe decidir",
          "apoio",
          40,
          ["gestao-equipe", "delegacao"],
          "Acolher é importante, mas deixar a equipe decidir um risco elétrico, depois de um erro, é abrir mão do comando.",
          "A equipe voltou a discutir o que fazer, e o risco continuou sem decisão."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. O setor de imagem pergunta quais exames podem seguir e quais devem ser remarcados, e quer uma resposta objetiva antes do fim do dia.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Diz que ainda não sabe e que o setor decida por conta própria.",
          "disse que não sabia e deixou o setor decidir",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Quem coordena a manutenção precisa ao menos oferecer o que se sabe e um critério; largar a decisão desampara o setor.",
          "O setor decidiu sem critério e remarcou mais exames do que o necessário."
        ),
        opcao(
          "Sugere remarcar tudo, para evitar qualquer risco, sem avaliar com o setor.",
          "sugeriu remarcar tudo sem avaliar com o setor",
          "apoio",
          70,
          ["comunicacao-cliente", "contingencia"],
          "Prudência é boa, mas remarcar tudo sem avaliar com o setor ignora exames que poderiam seguir com segurança.",
          "Os exames foram remarcados, e alguns pacientes urgentes esperaram mais do que o necessário."
        ),
        opcao(
          "Propõe com o setor uma lista de exames que seguem e de exames que remarcam, com critério claro e horário de revisão.",
          "propôs lista de exames com critério e revisão",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia", "gestao-os"],
          "Construir com o setor um critério claro e um horário de revisão equilibra segurança e continuidade do atendimento.",
          "O setor aceitou o critério, remarcou só o necessário e usou o horário de revisão para ajustar."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. O setor de imagem diz que perdeu exames por falta de aviso e exige uma resposta objetiva sobre os exames que restam.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Assume o aviso tardio, define com o setor o que segue e o que remarca, e fixa um horário de atualização.",
          "assumiu o aviso tardio e fixou a atualização",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Assumir o atraso do aviso e decidir com o setor o que segue, com horário de atualização, recupera a confiança.",
          "O setor aceitou o plano e passou a cobrar a atualização, e não mais a explicação."
        ),
        opcao(
          "Explica o ocorrido e pede que o setor aguarde novas informações.",
          "explicou o ocorrido e pediu que aguardassem",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Explicar é bom, mas pedir espera sem prazo nem critério mantém o setor sem referência.",
          "O setor aguardou, mas voltou a cobrar antes do fim do dia."
        ),
        opcao(
          "Diz que o problema é de segurança e que o setor deve se adaptar.",
          "disse que o setor deveria se adaptar",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Usar a segurança como argumento para encerrar a conversa afasta o cliente em vez de explicar a decisão.",
          "O setor se sentiu ignorado e levou a queixa à diretoria."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "Perto do fim do dia, o terceirizado quer pular a conferência de segurança prevista antes de religar o quadro, dizendo que “sempre fez assim” e que o cliente cobra a energia de volta.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "gestao-os"],
      [
        opcao(
          "Interrompe o serviço, exige a conferência de segurança e acompanha a execução até o fim.",
          "interrompeu e exigiu a conferência de segurança",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Segurança elétrica não se negocia: a conferência prevista vale mesmo com cobrança e com um profissional experiente.",
          "A conferência atrasou o religamento um pouco, e o cliente aceitou ao saber o motivo."
        ),
        opcao(
          "Pede cuidado e aceita a palavra dele de que tudo está seguro.",
          "aceitou a palavra do terceirizado",
          "apoio",
          40,
          ["aplicacao-nr-pop"],
          "A palavra de quem quer pular a conferência não substitui a conferência.",
          "Nada aconteceu daquela vez, mas a conferência pulada ficou registrada como falha."
        ),
        opcao(
          "Autoriza religar sem a conferência, para devolver a energia no horário que o cliente cobra.",
          "autorizou religar sem a conferência",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Autorizar pular a conferência de segurança para cumprir o horário é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "Houve um novo desarme com risco para a equipe, o serviço parou e a ocorrência foi formalizada."
        )
      ],
      "Sem decisão sua, o terceirizado religou o quadro sem a conferência e o desvio ficou registrado."
    ),
    no(
      "n4b",
      "tecnico",
      "A equipe quer usar um improviso para manter o setor funcionando enquanto o quadro está fora, sem avaliação formal. O técnico mais novo hesita e olha para você.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
      [
        opcao(
          "Diz que a equipe decide, desde que tenha cuidado.",
          "deixou a equipe decidir o improviso",
          "delegacao",
          40,
          ["aplicacao-nr-pop", "delegacao"],
          "Largar uma decisão de risco elétrico à equipe, com um recado de cuidado, não é liderar.",
          "A equipe seguiu com o improviso, e o técnico mais novo ficou com a responsabilidade que não era dele."
        ),
        opcao(
          "Aceita o improviso, mas pede que o técnico mais novo acompanhe e aprenda com o caso.",
          "aceitou o improviso com o novato acompanhando",
          "orientacao",
          70,
          ["gestao-equipe", "aplicacao-nr-pop"],
          "Pensar no desenvolvimento do novato é bom, mas o improviso sem avaliação formal não deveria ser aceito.",
          "O novato aprendeu, porém o improviso foi apontado como desvio na revisão."
        ),
        opcao(
          "Proíbe o improviso, explica o motivo à equipe e aciona a alternativa formal combinada com o setor.",
          "proibiu o improviso e acionou a alternativa formal",
          "direcao",
          100,
          ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
          "Proibir o improviso, explicar o motivo e acionar a alternativa formal protege a equipe e ensina o novato.",
          "A equipe entendeu o motivo, o técnico mais novo se sentiu amparado e o setor recebeu a alternativa formal."
        )
      ]
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. O quadro foi reparado com segurança e os exames voltam amanhã. A diretoria quer saber como a decisão foi tomada e o que muda.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
      [
        opcao(
          "Relata a linha do tempo, destaca a decisão de isolar a área e propõe um reforço sobre bloqueio e conferência, com dono e data.",
          "relatou a linha do tempo e propôs reforço",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
          "Valorizar a decisão certa e transformar o aprendizado em reforço, com dono e data, fortalece a cultura de segurança.",
          "A diretoria aprovou o reforço, e a equipe passou a citar o caso como exemplo."
        ),
        opcao(
          "Diz que foi um episódio isolado e que não há o que mudar.",
          "disse que foi episódio isolado",
          null,
          40,
          ["comunicacao-cliente"],
          "Tratar como isolado o que mostrou pressão para pular segurança desperdiça o aprendizado.",
          "A pressão para pular etapas voltou a aparecer semanas depois, sem preparo da equipe."
        ),
        opcao(
          "Relata os fatos e elogia a equipe, sem propor ajuste.",
          "relatou os fatos e elogiou a equipe",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e elogiar é bom, mas faltou transformar a experiência em melhoria concreta.",
          "A diretoria aceitou o relato e perguntou, na semana seguinte, o que tinha mudado."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. O quadro segue em avaliação, os exames foram perdidos e a diretoria exige explicação. A equipe se divide sobre quem decidiu o quê.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume parte da falha e promete revisar o procedimento.",
          "assumiu parte da falha e prometeu revisar",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
          "A diretoria valorizou a franqueza e pediu um plano concreto para a semana seguinte."
        ),
        opcao(
          "Assume a falha, expõe a linha do tempo, ouve a equipe e apresenta plano de correção com dono e data.",
          "assumiu a falha e apresentou plano com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir a equipe e apresentar um plano com dono e data transforma um mau dia em aprendizado.",
          "A diretoria aceitou o plano, e a equipe sentiu que o erro foi tratado sem procurar culpados."
        ),
        opcao(
          "Culpa o terceirizado e a equipe pela perda dos exames.",
          "culpou o terceirizado e a equipe",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar os outros esconde a falha de coordenação e afasta quem poderia ajudar a corrigir.",
          "A equipe se sentiu exposta, e a diretoria notou que ninguém assumia a coordenação."
        )
      ]
    )
  ]
});
