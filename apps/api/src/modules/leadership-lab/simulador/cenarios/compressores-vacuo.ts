// Cenário: compressores e vácuo clínico. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e
// pedagógica). Nível gerencial: nada aqui diz como reparar ou ajustar uma central.
import { no, opcao, pacote } from "../construtor.js";

export const compressoresVacuo = pacote({
  categoria: {
    id: "compressores-vacuo",
    nome: "Compressores e vácuo clínico",
    descricao: "Centrais de ar comprimido medicinal e de vácuo clínico, reservas e fornecedores.",
    palavrasFortes: [
      "compressor",
      "compressores",
      "vacuo",
      "vacuo clinico",
      "bomba de vacuo",
      "ar comprimido",
      "central de vacuo",
      "aspiracao"
    ],
    palavrasFracas: ["central", "pressao", "reserva", "unidade", "ruido"],
    exemplos: [
      "Um dos compressores da central de ar comprimido parou.",
      "A bomba de vácuo clínico está operando sem reserva."
    ]
  },
  titulo: "Central de compressores e vácuo sem reserva",
  fontes: ["nhs-htm-02-01", "anvisa-rdc-63-2011", "nr-13", "oms-programas"],
  aberturas: [
    "Início do turno. O técnico informa que uma unidade da central de ar comprimido e vácuo está fora de operação e que a outra trabalha sozinha. O centro cirúrgico tem agenda cheia. Você lidera o turno. O que faz?",
    "Uma unidade da central de compressores e vácuo parou e a outra opera sozinha. O centro cirúrgico tem agenda cheia, o fornecedor pede dois dias e a sua equipe está dividida. Você decide o que priorizar e comunicar.",
    "A central de compressores e vácuo opera sem reserva e o fornecedor propõe um prazo longo de reparo. A direção quer saber o risco para as cirurgias da semana e o custo da solução. Você responde pelo contrato."
  ],
  nos: [
    no(
      "n1",
      "tecnico",
      "",
      "direcao",
      ["contingencia", "gestao-os", "comunicacao-cliente"],
      [
        opcao(
          "Informa o centro cirúrgico e a direção sobre a falta de reserva, aciona o plano de contingência e pede o reparo em caráter de urgência.",
          "avisou o setor e pediu reparo urgente",
          "direcao",
          100,
          ["contingencia", "gestao-os", "comunicacao-cliente"],
          "Quando falta reserva, quem usa a central precisa saber já: aviso, contingência e urgência vêm antes de esperar que nada falhe.",
          "O centro cirúrgico soube do risco a tempo de ajustar a agenda, e o fornecedor tratou o pedido como urgente."
        ),
        opcao(
          "Mantém a rotina e espera que a unidade restante aguente até o reparo.",
          "manteve a rotina esperando que aguentasse",
          null,
          40,
          ["contingencia", "decisao-pressao"],
          "Apostar que a unidade restante aguenta, sem avisar quem depende dela, transfere o risco para os pacientes.",
          "Nada falhou naquele dia, mas o centro cirúrgico descobriu a falta de reserva por conta própria."
        ),
        opcao(
          "Pede ao técnico que acompanhe de perto a unidade restante e relate qualquer mudança.",
          "pediu acompanhamento da unidade restante",
          "orientacao",
          70,
          ["gestao-os", "contingencia"],
          "Acompanhar de perto é bom, mas o centro cirúrgico precisava ser avisado e ter um plano.",
          "O técnico acompanhou com atenção, mas o setor continuou sem saber que estava sem reserva."
        )
      ],
      "Sem decisão sua, a rotina seguiu e ninguém avisou o centro cirúrgico sobre a falta de reserva."
    ),
    no(
      "n2a",
      "responsavel-assistencial",
      "Informada, a chefia do centro cirúrgico pergunta se pode manter a agenda do dia e pede alternativas, caso a unidade restante também falhe.",
      "orientacao",
      ["comunicacao-cliente", "contingencia", "gestao-os"],
      [
        opcao(
          "Diz que a agenda pode seguir normal, pois o reparo será rápido.",
          "disse que a agenda podia seguir normal",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Garantir normalidade sem saber a duração do reparo coloca a agenda acima da segurança.",
          "A agenda seguiu, mas o prazo do reparo estourou e cirurgias foram remarcadas de última hora."
        ),
        opcao(
          "Propõe com a chefia uma agenda ajustada por prioridade clínica, um plano de contingência e pontos de reavaliação ao longo do dia.",
          "ajustou a agenda com a chefia e criou contingência",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia", "gestao-os"],
          "Ajustar a agenda por prioridade clínica, com contingência e reavaliação, protege os pacientes e dá previsibilidade ao setor.",
          "A chefia aceitou o ajuste, e o dia seguiu com um plano claro para o caso de nova falha."
        ),
        opcao(
          "Deixa a chefia decidir a agenda sozinha, oferecendo apoio se ela precisar.",
          "deixou a chefia decidir a agenda sozinha",
          "apoio",
          70,
          ["delegacao", "comunicacao-cliente"],
          "Oferecer apoio é bom, mas a chefia pedia uma proposta, e não só disponibilidade.",
          "A chefia decidiu com cautela excessiva e cancelou mais cirurgias do que o necessário."
        )
      ]
    ),
    no(
      "n2b",
      "supervisor",
      "Sem aviso, o centro cirúrgico descobriu a falta de reserva e a chefia acionou a diretoria. O técnico está desconfortável e o fornecedor pergunta quem autoriza o reparo urgente.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "materiais-custos"],
      [
        opcao(
          "Pede ao técnico que explique à chefia e aguarda a diretoria se manifestar.",
          "pediu ao técnico que explicasse e aguardou",
          null,
          40,
          ["decisao-pressao", "delegacao"],
          "Quem coordena precisa dar a cara: empurrar a explicação ao técnico e esperar a diretoria deixa o problema sem dono.",
          "O técnico explicou sem o quadro completo, e a diretoria cobrou resposta de quem coordenava."
        ),
        opcao(
          "Liga para a chefia explicando a situação, mas deixa a autorização do reparo para o dia seguinte.",
          "explicou à chefia e adiou a autorização",
          "orientacao",
          70,
          ["comunicacao-cliente", "materiais-custos"],
          "Explicar é necessário, mas adiar a autorização prolonga o risco e atrasa o reparo.",
          "A chefia aceitou a explicação, mas o fornecedor só começou no outro dia."
        ),
        opcao(
          "Assume a conversa com a chefia e a direção, reconhece a falha no aviso, autoriza o pedido urgente e registra o ocorrido.",
          "assumiu a conversa e autorizou o pedido urgente",
          "direcao",
          100,
          ["decisao-pressao", "comunicacao-cliente", "materiais-custos"],
          "Assumir, reconhecer a falha, autorizar a urgência e registrar devolve a direção à resposta e protege a confiança.",
          "A direção viu comando na resposta, e o fornecedor iniciou o atendimento urgente no mesmo dia."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. A chefia do centro cirúrgico pede uma previsão firme do reparo para decidir sobre as cirurgias eletivas de amanhã.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Informa o que o fornecedor confirmou, o que ainda é incerto e combina com ela um horário para decidir sobre as eletivas.",
          "informou o confirmado, o incerto e o horário",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Separar o que é certo do que é incerto e marcar um horário de decisão dá à chefia base para decidir sem falsa promessa.",
          "A chefia decidiu no horário combinado, com base em informação honesta, e agradeceu a clareza."
        ),
        opcao(
          "Dá a previsão mais otimista do fornecedor e pede que a chefia confie.",
          "deu a previsão otimista e pediu confiança",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Pedir confiança sobre a previsão mais otimista cria uma expectativa que pode não se cumprir.",
          "A chefia manteve as eletivas. Quando a previsão atrasou, precisou cancelar na véspera."
        ),
        opcao(
          "Diz que não pode dar previsão e que ela decida sem informação.",
          "disse que não podia dar previsão",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Negar toda informação deixa a chefia decidindo no escuro, quando poderia ter ao menos o que já se sabe.",
          "A chefia cancelou as eletivas por precaução, sem necessidade, e registrou a queixa."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. A chefia do centro cirúrgico, irritada, diz que a falta de aviso custou confiança e exige uma previsão firme para as cirurgias de amanhã.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Pede desculpas, repassa a previsão do fornecedor e promete nova informação no dia seguinte.",
          "pediu desculpas e prometeu informar no dia seguinte",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Pedir desculpas ajuda, mas deixar a nova informação só para o dia seguinte não dá à chefia o que ela precisa agora.",
          "A chefia aceitou as desculpas, mas decidiu cancelar eletivas por falta de informação para amanhã."
        ),
        opcao(
          "Assume o erro, repassa o que se sabe e o que não se sabe e define com ela quando as eletivas serão reavaliadas.",
          "assumiu o erro e definiu a reavaliação das eletivas",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Assumir o erro e fixar quando a decisão será reavaliada recupera a confiança sem prometer o que não se controla.",
          "A chefia aceitou o combinado e voltou a tratar a manutenção como parceira."
        ),
        opcao(
          "Sugere cancelar as eletivas de amanhã sem esperar nenhuma informação do fornecedor.",
          "sugeriu cancelar as eletivas sem informação",
          null,
          40,
          ["decisao-pressao", "contingencia"],
          "Cancelar tudo por precaução, sem informação, transfere o custo para os pacientes e esconde a falta de plano.",
          "As eletivas foram canceladas. No dia seguinte, o fornecedor concluiu o reparo antes do previsto."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "O fornecedor oferece reparo imediato com uma peça alternativa, mais barata e disponível hoje, mas sem a garantia do fabricante. A direção quer economia e pede a sua opinião.",
      "direcao",
      ["materiais-custos", "aplicacao-nr-pop", "gestao-os"],
      [
        opcao(
          "Aceita a peça alternativa para economizar, desde que o técnico acompanhe o serviço.",
          "aceitou a peça alternativa com acompanhamento",
          "orientacao",
          70,
          ["materiais-custos", "gestao-equipe"],
          "Acompanhar o serviço ajuda, mas aceitar peça sem garantia do fabricante expõe a central e o contrato.",
          "O reparo ficou pronto, mas a falta de garantia entrou como risco aberto no contrato."
        ),
        opcao(
          "Deixa a decisão sobre a peça para a direção, sem opinar.",
          "deixou a decisão da peça para a direção",
          null,
          40,
          ["materiais-custos", "decisao-pressao"],
          "A direção pediu opinião técnica: calar-se devolve a decisão sem a informação de que ela precisa.",
          "A direção escolheu pelo preço, e o risco da peça só foi discutido depois da instalação."
        ),
        opcao(
          "Recusa a peça sem garantia, apresenta à direção o risco e o custo de cada alternativa e pede aprovação formal da escolha.",
          "recusou a peça e levou as alternativas à direção",
          "direcao",
          100,
          ["materiais-custos", "aplicacao-nr-pop", "decisao-pressao"],
          "Mostrar risco e custo de cada alternativa e pedir aprovação formal une economia e segurança, com a decisão registrada.",
          "A direção aprovou a peça original, e a escolha ficou registrada com os motivos."
        )
      ]
    ),
    no(
      "n4b",
      "seguranca-trabalho",
      "A segunda unidade apresenta oscilação. O técnico propõe desativar um alarme que incomoda a equipe do centro cirúrgico, para “trabalhar em paz”.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "contingencia"],
      [
        opcao(
          "Mantém o alarme ativo, explica o motivo ao técnico e à chefia e aciona o plano de contingência para a agenda.",
          "manteve o alarme e acionou a contingência",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "contingencia"],
          "O alarme é a defesa do setor: mantê-lo, explicar e acionar a contingência é a decisão firme que a situação pedia.",
          "O alarme seguiu ativo, a agenda foi ajustada e o técnico entendeu o motivo."
        ),
        opcao(
          "Autoriza desativar o alarme até o reparo, para a equipe trabalhar sem interrupção.",
          "autorizou desativar o alarme até o reparo",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Desativar um alarme para ter sossego, num setor crítico, é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "Sem o alarme, a oscilação passou despercebida por um tempo, e o episódio virou registro de falha."
        ),
        opcao(
          "Pede ao técnico que decida com a chefia se o alarme deve continuar ativo.",
          "deixou o alarme à decisão do técnico e da chefia",
          "apoio",
          40,
          ["delegacao", "aplicacao-nr-pop"],
          "Desativar ou não um alarme é decisão de quem coordena, e não do técnico com a chefia.",
          "Técnico e chefia discordaram, e o alarme ficou num limbo, sem registro de quem decidiu."
        )
      ],
      "Sem decisão sua, o alarme foi desativado por conta própria e ninguém registrou."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. O reparo terminou e a central voltou a ter reserva. A direção quer saber o que aconteceu e como evitar ficar sem reserva de novo.",
      "orientacao",
      ["comunicacao-cliente", "materiais-custos", "gestao-equipe"],
      [
        opcao(
          "Informa que tudo voltou ao normal e agradece à equipe.",
          "informou o retorno ao normal e agradeceu",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Agradecer e informar é bom, mas faltou propor o que evita repetir a falta de reserva.",
          "A direção aceitou, e na semana seguinte perguntou o que tinha mudado no estoque de peças."
        ),
        opcao(
          "Apresenta a linha do tempo, o custo da decisão tomada e uma proposta de revisão do estoque de peças críticas, com dono e prazo.",
          "apresentou linha do tempo e proposta de estoque",
          "orientacao",
          100,
          ["comunicacao-cliente", "materiais-custos", "delegacao"],
          "Mostrar fatos, custo e uma proposta com dono e prazo transforma o episódio em prevenção.",
          "A direção aprovou a revisão do estoque, e o caso passou a orientar as próximas compras."
        ),
        opcao(
          "Diz que o fornecedor atrasou e que o problema foi dele.",
          "culpou o fornecedor pelo atraso",
          null,
          40,
          ["comunicacao-cliente"],
          "Atribuir tudo ao fornecedor esconde o que a própria gestão poderia ter feito diferente.",
          "A direção anotou a queixa, mas o mesmo tipo de espera voltou a acontecer meses depois."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. A central segue sem reserva, o centro cirúrgico reduziu a agenda e a direção cobra explicações. A equipe sente falta de direção.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Aponta o atraso do fornecedor e o corte de custos como causas.",
          "apontou o fornecedor e o corte de custos",
          null,
          40,
          ["comunicacao-cliente", "gestao-equipe"],
          "Listar causas externas sem olhar a própria coordenação afasta a equipe e adia o aprendizado.",
          "A direção percebeu que a coordenação não tinha se avaliado, e a equipe se sentiu sem apoio."
        ),
        opcao(
          "Assume parte da falha e pede mais um dia para trazer um plano.",
          "assumiu parte da falha e pediu mais um dia",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas pedir tempo sem plano ainda deixa a direção esperando.",
          "A direção deu o prazo, com a cobrança de um plano concreto no dia seguinte."
        ),
        opcao(
          "Assume a falha de coordenação, expõe a linha do tempo, ouve a equipe e apresenta plano de recuperação com dono e data.",
          "assumiu a falha e apresentou plano com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir a equipe e apresentar um plano com dono e data transforma um mau momento em aprendizado.",
          "A direção aceitou o plano, e a equipe sentiu que o erro foi tratado sem procurar culpados."
        )
      ]
    )
  ]
});
