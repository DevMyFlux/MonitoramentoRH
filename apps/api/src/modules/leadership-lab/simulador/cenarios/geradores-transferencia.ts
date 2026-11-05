// Cenário: geradores e transferência de energia. CONTEÚDO DEMONSTRATIVO (pendente de validação
// técnica e pedagógica). Nível gerencial: nada aqui descreve como testar ou reparar um gerador.
import { no, opcao, pacote } from "../construtor.js";

export const geradoresTransferencia = pacote({
  categoria: {
    id: "geradores-transferencia",
    nome: "Geradores e transferência de energia",
    descricao: "Grupos geradores, chaves de transferência, nobreaks e falta de energia.",
    palavrasFortes: [
      "gerador",
      "geradores",
      "grupo gerador",
      "chave de transferencia",
      "transferencia automatica",
      "nobreak",
      "queda de energia",
      "falta de energia"
    ],
    palavrasFracas: ["energia", "diesel", "combustivel", "blackout", "teste"],
    exemplos: [
      "O gerador não assumiu depois da queda de energia.",
      "O grupo gerador falhou no teste de rotina."
    ]
  },
  titulo: "Gerador falha no teste de rotina",
  fontes: ["nhs-htm-06-01", "nr-10", "anvisa-rdc-63-2011", "oms-programas"],
  aberturas: [
    "No teste de rotina do gerador, a transferência demorou e algumas áreas ficaram sem energia por instantes. O técnico quer repetir o teste agora, e a UTI ainda não sabe. Você lidera o turno. O que faz?",
    "O gerador falhou no teste de rotina: a transferência demorou e áreas ficaram sem energia por instantes. O técnico quer repetir o teste agora, e a UTI ainda não foi informada. Você decide como proceder e comunicar.",
    "O gerador falhou no teste de rotina e áreas assistenciais ficaram sem energia por instantes. A direção quer saber se o hospital está protegido, e o contrato prevê relato formal da ocorrência. Você responde pela decisão."
  ],
  nos: [
    no(
      "n1",
      "tecnico",
      "",
      "direcao",
      ["contingencia", "comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Pede ao técnico que repita o teste agora e avisa a UTI depois do resultado.",
          "mandou repetir o teste e avisar depois",
          "orientacao",
          70,
          ["gestao-os", "contingencia"],
          "Repetir o teste pode ser útil, mas a assistência precisa saber antes que o hospital pode estar desprotegido.",
          "O novo teste foi feito, mas a UTI soube da falha só depois e ficou sem tempo de se preparar."
        ),
        opcao(
          "Registra que houve uma pequena oscilação e segue a rotina, sem relatar à assistência.",
          "registrou oscilação e seguiu a rotina",
          null,
          40,
          ["contingencia", "comunicacao-cliente"],
          "Minimizar uma falha de transferência, sem informar quem depende da energia, esconde um risco real.",
          "A falha ficou sem tratamento e a UTI descobriu o episódio por conversas de corredor."
        ),
        opcao(
          "Suspende novos testes, informa a assistência e a direção, aciona o plano de contingência de energia e chama o fornecedor.",
          "suspendeu testes, informou todos e chamou o fornecedor",
          "direcao",
          100,
          ["contingencia", "comunicacao-cliente", "decisao-pressao"],
          "Quando a proteção de energia falha, avisar quem depende dela, acionar a contingência e chamar o fornecedor vem antes de qualquer novo teste.",
          "A assistência soube do risco a tempo de se preparar, e o fornecedor iniciou o atendimento."
        )
      ],
      "Sem decisão sua, o episódio ficou sem aviso e sem registro."
    ),
    no(
      "n2a",
      "fornecedor",
      "O fornecedor pode vir hoje, mas cobra taxa de urgência. A assistência pergunta o que acontece se faltar energia antes de ele chegar.",
      "orientacao",
      ["gestao-os", "contingencia", "materiais-custos"],
      [
        opcao(
          "Aprova a urgência, combina com a assistência as medidas provisórias e define quem avisa se houver nova falha.",
          "aprovou a urgência e combinou medidas provisórias",
          "orientacao",
          100,
          ["gestao-os", "contingencia", "comunicacao-cliente"],
          "Pagar a urgência quando o risco é alto e combinar medidas provisórias com a assistência protege os pacientes e deixa claro quem avisa.",
          "O fornecedor chegou no mesmo dia, e a assistência soube o que fazer em caso de nova falha."
        ),
        opcao(
          "Aprova a urgência e confia que a assistência saberá o que fazer em caso de falha.",
          "aprovou a urgência e confiou na assistência",
          "apoio",
          70,
          ["materiais-custos", "delegacao"],
          "Aprovar a urgência é correto, mas as medidas provisórias deveriam ser combinadas, e não presumidas.",
          "O reparo foi urgente, porém cada setor entendeu as medidas provisórias de um jeito."
        ),
        opcao(
          "Adia a visita para o horário comercial para evitar a taxa.",
          "adiou a visita para evitar a taxa",
          null,
          40,
          ["materiais-custos", "decisao-pressao"],
          "Economizar a taxa de urgência com o hospital exposto inverte a ordem de prioridade.",
          "A visita foi adiada, e o hospital passou a noite sem uma resposta definitiva."
        )
      ]
    ),
    no(
      "n2b",
      "responsavel-assistencial",
      "A UTI soube da falha pelos monitores, e o responsável assistencial chegou furioso, perguntando se o hospital está exposto. O técnico quer se explicar, mas quem coordena é você.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Pede desculpas ao responsável, deixa o técnico explicar e promete retorno depois.",
          "pediu desculpas e deixou o técnico explicar",
          "orientacao",
          70,
          ["comunicacao-cliente", "delegacao"],
          "Desculpas ajudam, mas a explicação e o plano são de quem coordena.",
          "O técnico explicou o possível, e o responsável cobrou uma resposta de quem coordenava."
        ),
        opcao(
          "Diz ao técnico que fale com o responsável, pois ele conhece o equipamento.",
          "mandou o técnico falar com o responsável",
          "delegacao",
          40,
          ["delegacao", "decisao-pressao"],
          "Passar a conversa difícil ao técnico expõe-o e deixa o responsável sem interlocutor que decida.",
          "O técnico ficou exposto, e o responsável levou a queixa à diretoria."
        ),
        opcao(
          "Assume a conversa, reconhece o atraso no aviso, aciona o plano de contingência e define quando o responsável terá nova informação.",
          "assumiu a conversa e acionou a contingência",
          "direcao",
          100,
          ["decisao-pressao", "comunicacao-cliente", "contingencia"],
          "Quando a assistência está furiosa, assumir, reconhecer o atraso e dar um plano com horário recupera a confiança.",
          "O responsável viu comando na resposta e aceitou o plano e o horário de atualização."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. O responsável assistencial pergunta se o hospital está protegido caso falte energia hoje e pede um posicionamento por escrito.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Envia o que se sabe, o que não se sabe, as medidas provisórias e quem aciona o quê se faltar energia.",
          "enviou posicionamento escrito com medidas e responsáveis",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Um posicionamento escrito, honesto sobre o que falta saber e com responsáveis definidos, dá à assistência o que ela precisa para se preparar.",
          "A assistência usou o texto para orientar os setores e agradeceu a clareza."
        ),
        opcao(
          "Garante verbalmente que tudo foi feito e que a assistência pode ficar tranquila.",
          "garantiu verbalmente que estava tudo feito",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Tranquilizar é bom, mas garantir sem registro nem detalhe não dá à assistência o que ela pediu.",
          "A assistência aceitou, porém voltou a pedir o texto antes da troca de plantão."
        ),
        opcao(
          "Diz que a assistência é responsável por seu próprio plano de energia.",
          "disse que o plano era da assistência",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "O plano de energia do hospital é compartilhado: empurrá-lo à assistência foge da responsabilidade.",
          "A assistência se sentiu abandonada e levou a queixa à diretoria."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. O responsável assistencial exige saber se o hospital está protegido caso falte energia hoje e diz que não aceitará mais respostas vagas.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Diz que não há como garantir nada até a visita do fornecedor.",
          "disse que nada podia ser garantido",
          null,
          40,
          ["comunicacao-cliente"],
          "Dizer que nada pode ser garantido, sem oferecer o que se sabe, deixa a assistência sem referência.",
          "A assistência montou um plano por conta própria e levou a queixa à diretoria."
        ),
        opcao(
          "Assume as respostas vagas, apresenta o que se sabe, as medidas provisórias e um horário firme de atualização.",
          "assumiu as respostas vagas e fixou atualização",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Reconhecer a vagueza, mostrar o que há e marcar um horário firme recupera a confiança sem prometer o que não se controla.",
          "O responsável aceitou o combinado e passou a cobrar a atualização no horário."
        ),
        opcao(
          "Apresenta as medidas provisórias, mas sem horário de atualização.",
          "apresentou as medidas sem horário de atualização",
          "orientacao",
          70,
          ["comunicacao-cliente", "contingencia"],
          "Mostrar as medidas ajuda, mas sem horário de atualização a assistência segue sem referência.",
          "O responsável aceitou as medidas, mas voltou a cobrar um horário no fim do plantão."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "O fornecedor chega e propõe um reparo rápido, sem parar a instalação por completo, para “não atrapalhar o hospital”. A equipe de segurança elétrica ainda não foi acionada.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "materiais-custos"],
      [
        opcao(
          "Exige a participação da equipe de segurança, combina com a assistência a janela do serviço e mantém o registro do que será feito.",
          "exigiu a segurança e combinou a janela do serviço",
          "direcao",
          100,
          ["aplicacao-nr-pop", "comunicacao-cliente", "gestao-os"],
          "Serviço em instalação elétrica de hospital pede equipe de segurança, janela combinada com a assistência e registro.",
          "O serviço foi feito com a segurança presente, a assistência ciente da janela e tudo registrado."
        ),
        opcao(
          "Libera o reparo com a instalação em uso, porque o fornecedor é especializado.",
          "liberou o reparo com a instalação em uso",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Liberar serviço em instalação em uso, sem a equipe de segurança, é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "Houve um desarme inesperado durante o serviço, a assistência foi surpreendida e a ocorrência foi formalizada."
        ),
        opcao(
          "Pede que o fornecedor tome cuidado e avise se algo sair do planejado.",
          "pediu cuidado ao fornecedor",
          "apoio",
          40,
          ["aplicacao-nr-pop", "delegacao"],
          "Pedir cuidado não substitui a participação da equipe de segurança e a janela combinada.",
          "O serviço terminou sem incidente, mas sem registro nem aviso à assistência."
        )
      ],
      "Sem decisão sua, o fornecedor iniciou o reparo sem a equipe de segurança."
    ),
    no(
      "n4b",
      "tecnico",
      "A tarde avança, o plano provisório cansa a equipe e o técnico propõe dispensar a vigilância da energia durante a noite, “porque nada aconteceu até agora”.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
      [
        opcao(
          "Concorda, pois a equipe está cansada e nada aconteceu até agora.",
          "concordou em dispensar a vigilância",
          "apoio",
          40,
          ["gestao-equipe", "aplicacao-nr-pop"],
          "O cansaço é real, mas dispensar a vigilância porque nada aconteceu confunde sorte com segurança.",
          "A noite passou sem vigilância, e uma oscilação foi percebida só pela UTI."
        ),
        opcao(
          "Mantém a vigilância, reforça a escala com revezamento e explica o motivo ao técnico e à assistência.",
          "manteve a vigilância e reforçou a escala",
          "direcao",
          100,
          ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
          "Manter a vigilância e cuidar do cansaço com revezamento protege o hospital e respeita a equipe.",
          "A equipe aceitou o revezamento, e a vigilância seguiu até o fim do plano."
        ),
        opcao(
          "Mantém a vigilância, mas só por parte da noite.",
          "manteve a vigilância só por parte da noite",
          "orientacao",
          70,
          ["gestao-equipe", "aplicacao-nr-pop"],
          "Reduzir a vigilância é um meio-termo que deixa a pior parte da noite sem cobertura.",
          "A vigilância parcial cobriu parte da noite, e o restante ficou sem acompanhamento."
        )
      ]
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. O gerador foi corrigido e o teste final passou. A direção quer saber o que aconteceu, o custo e o que muda no teste de rotina.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "contingencia"],
      [
        opcao(
          "Diz que foi uma falha pontual do equipamento e não do processo.",
          "disse que foi falha pontual do equipamento",
          null,
          40,
          ["comunicacao-cliente"],
          "Atribuir tudo ao equipamento esconde o que a comunicação e o preparo do teste poderiam melhorar.",
          "A direção aceitou, mas o mesmo tipo de surpresa no teste voltou a acontecer."
        ),
        opcao(
          "Relata os fatos, o custo e agradece à equipe.",
          "relatou os fatos e o custo e agradeceu",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e agradecer é bom, mas faltou transformar o aprendizado em melhoria concreta.",
          "A direção aceitou o relato e perguntou, na semana seguinte, o que tinha mudado."
        ),
        opcao(
          "Relata os fatos e o custo, reconhece a equipe e propõe revisar como o teste é comunicado, com dono e prazo.",
          "relatou, reconheceu a equipe e propôs revisão com dono e prazo",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Mostrar fatos e custo, reconhecer a equipe e propor melhoria com dono e prazo fecha o ciclo e previne repetição.",
          "A direção aprovou a revisão, e os próximos testes passaram a ser avisados com antecedência."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. O gerador segue em observação, a assistência perdeu confiança e a direção exige explicações. A equipe sente que a decisão veio tarde demais.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume a falha de comunicação, expõe a linha do tempo, ouve a equipe e apresenta plano com dono e data.",
          "assumiu a falha e apresentou plano com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir a equipe e apresentar plano com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o plano, e a equipe sentiu que o erro foi tratado sem procurar culpados."
        ),
        opcao(
          "Assume parte da falha e pede mais um dia para trazer um plano.",
          "assumiu parte da falha e pediu mais um dia",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas pedir tempo sem plano ainda deixa a direção esperando.",
          "A direção deu o prazo e cobrou um plano concreto no dia seguinte."
        ),
        opcao(
          "Culpa o fornecedor pela demora e pelo custo.",
          "culpou o fornecedor pela demora e pelo custo",
          null,
          40,
          ["comunicacao-cliente", "gestao-equipe"],
          "Culpar o fornecedor esconde a falha de coordenação e não ajuda a prevenir a repetição.",
          "A direção percebeu que a coordenação não tinha se avaliado, e a equipe se sentiu sem apoio."
        )
      ]
    )
  ]
});
