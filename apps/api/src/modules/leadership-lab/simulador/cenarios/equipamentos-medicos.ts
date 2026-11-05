// Cenário: equipamentos médico-hospitalares. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e
// pedagógica). Nível gerencial: nada aqui descreve como verificar, calibrar ou reparar um
// equipamento; isso é da engenharia clínica, do fabricante e da norma.
import { no, opcao, pacote } from "../construtor.js";

export const equipamentosMedicos = pacote({
  categoria: {
    id: "equipamentos-medicos",
    nome: "Equipamentos médico-hospitalares",
    descricao: "Bombas de infusão, monitores, ventiladores e demais equipamentos assistenciais.",
    palavrasFortes: [
      "equipamento medico",
      "equipamentos medicos",
      "bomba de infusao",
      "monitor multiparametrico",
      "ventilador pulmonar",
      "desfibrilador",
      "engenharia clinica",
      "manutencao preventiva"
    ],
    palavrasFracas: ["equipamento", "monitor", "calibracao", "falha", "reserva"],
    exemplos: [
      "Uma bomba de infusão da UTI apresentou falha durante o plantão.",
      "O monitor multiparamétrico da recuperação desliga sozinho."
    ]
  },
  titulo: "Falha em equipamento médico na UTI",
  fontes: ["anvisa-rdc-63-2011", "anvisa-rdc-7-2010", "oms-programas"],
  aberturas: [
    "Início do turno. Uma bomba de infusão da UTI apresentou falha e a enfermagem a colocou de lado. Há outras iguais em uso, e o técnico quer reuni-las para olhar depois. Você lidera o turno.",
    "Uma bomba de infusão da UTI falhou e há outras do mesmo lote em uso. A enfermagem pede reposição imediata, a engenharia clínica está em outra urgência e o responsável assistencial não foi avisado. Você decide a prioridade.",
    "Uma bomba de infusão falhou na UTI e há outras do mesmo lote em uso. A direção quer saber o risco, e o contrato prevê comunicação à engenharia clínica e ao fabricante. Você responde pela decisão e pelo registro."
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
          "Deixa o equipamento de lado e segue o turno, para olhar depois com calma.",
          "deixou o equipamento de lado para olhar depois",
          null,
          40,
          ["contingencia", "gestao-os"],
          "Deixar o equipamento de lado, sem registrar nem avisar, esconde um risco que atinge os outros do mesmo lote.",
          "O equipamento ficou sem registro, e a UTI não soube que os outros do lote mereciam atenção."
        ),
        opcao(
          "Retira o equipamento de uso, avisa a engenharia clínica e o responsável assistencial, registra a falha e combina a reposição provisória.",
          "retirou o equipamento, avisou todos e registrou a falha",
          "direcao",
          100,
          ["contingencia", "comunicacao-cliente", "aplicacao-nr-pop"],
          "Retirar de uso, avisar quem responde, registrar a falha e combinar a reposição protege os pacientes e os outros equipamentos do lote.",
          "A engenharia clínica iniciou a verificação, o responsável assistencial ficou informado e a reposição foi combinada."
        ),
        opcao(
          "Retira o equipamento de uso e avisa a engenharia clínica, mas deixa o aviso ao responsável assistencial para depois.",
          "retirou o equipamento e adiou o aviso ao responsável",
          "orientacao",
          70,
          ["contingencia", "comunicacao-cliente"],
          "Retirar e avisar a engenharia clínica é correto, mas o responsável assistencial também precisava saber já.",
          "A engenharia clínica começou a verificação, e o responsável reclamou de ter sido avisado depois."
        )
      ],
      "Sem decisão sua, o equipamento ficou de lado sem registro e sem aviso."
    ),
    no(
      "n2a",
      "engenharia-clinica",
      "A engenharia clínica confirma a falha e pede para verificar os equipamentos do mesmo lote. A UTI pergunta quantos poderão ser retirados sem faltar reposição.",
      "orientacao",
      ["gestao-os", "contingencia", "comunicacao-cliente"],
      [
        opcao(
          "Deixa a engenharia clínica e a UTI combinarem e oferece ajuda.",
          "deixou a engenharia e a UTI combinarem",
          "apoio",
          70,
          ["delegacao", "comunicacao-cliente"],
          "Oferecer ajuda é bom, mas a ordem de verificação e a reposição pedem uma proposta de quem coordena.",
          "A engenharia clínica e a UTI combinaram entre si, e a reposição ficou aquém do necessário."
        ),
        opcao(
          "Combina com a engenharia clínica e a UTI uma ordem de verificação e uma reposição provisória, e informa o que muda a cada etapa.",
          "combinou ordem de verificação e reposição provisória",
          "orientacao",
          100,
          ["gestao-os", "contingencia", "comunicacao-cliente"],
          "Uma ordem de verificação e uma reposição provisória combinadas com quem usa os equipamentos mantêm a assistência enquanto o lote é verificado.",
          "A UTI manteve os cuidados com a reposição combinada, e a engenharia clínica verificou sem pressa."
        ),
        opcao(
          "Diz que a UTI se vire com o que tem, para não atrasar a verificação.",
          "mandou a UTI se virar com o que tinha",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Deixar a UTI sem reposição para acelerar a verificação inverte a prioridade: os pacientes vêm antes.",
          "A UTI ficou com poucos equipamentos e levou a queixa à diretoria."
        )
      ]
    ),
    no(
      "n2b",
      "responsavel-assistencial",
      "A falha ficou sem registro, o equipamento voltou a ser usado e uma equipe percebeu o problema de novo. O responsável assistencial quer saber quem decidiu e por que ninguém avisou.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "aplicacao-nr-pop"],
      [
        opcao(
          "Diz que a engenharia clínica deveria ter acompanhado e que isso não é com a manutenção.",
          "disse que não era com a manutenção",
          "delegacao",
          40,
          ["delegacao", "decisao-pressao"],
          "Quando a falha ficou sem dono, empurrar a responsabilidade a outro setor é recusar a coordenação.",
          "O responsável levou a queixa à diretoria, e os dois setores trocaram acusações."
        ),
        opcao(
          "Explica o ocorrido e retira o equipamento agora, deixando o registro para depois.",
          "explicou, retirou o equipamento e adiou o registro",
          "orientacao",
          70,
          ["comunicacao-cliente", "aplicacao-nr-pop"],
          "Retirar o equipamento é urgente, mas o registro da falha também não podia esperar.",
          "O equipamento saiu de uso, e a falta de registro dificultou a verificação do lote."
        ),
        opcao(
          "Assume a falha, retira o equipamento, avisa a engenharia clínica, registra a linha do tempo e informa a direção.",
          "assumiu, retirou o equipamento e registrou a linha do tempo",
          "direcao",
          100,
          ["decisao-pressao", "comunicacao-cliente", "aplicacao-nr-pop"],
          "Quando a falha ficou sem dono, assumir, retirar de uso, avisar a engenharia clínica e registrar devolve o controle.",
          "O equipamento saiu de uso, a engenharia clínica iniciou a verificação e a direção foi informada."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. O responsável assistencial pergunta se pode confiar nos demais equipamentos do lote e pede um posicionamento claro por escrito.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Diz que a responsabilidade pelos equipamentos é da engenharia clínica.",
          "disse que a responsabilidade era da engenharia clínica",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A comunicação com a assistência é de quem coordena a resposta, e não só da engenharia clínica.",
          "A engenharia clínica, sem o quadro completo, deu respostas diferentes das suas."
        ),
        opcao(
          "Garante que a manutenção acompanha de perto e pede confiança.",
          "garantiu acompanhamento próximo e pediu confiança",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "Pedir confiança acolhe, mas o responsável pediu um posicionamento por escrito.",
          "O responsável aceitou, mas voltou a pedir o texto antes da troca de plantão."
        ),
        opcao(
          "Envia o que se sabe, o que está em verificação, a reposição provisória e o horário da próxima atualização.",
          "enviou posicionamento escrito com horário de atualização",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Um posicionamento escrito, honesto sobre o que está em verificação e com horário de atualização, dá ao responsável o que ele precisa.",
          "O responsável distribuiu o texto aos plantões e agradeceu a clareza."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. O responsável assistencial reclama que a UTI usou um equipamento com falha e exige saber se os demais estão seguros.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Explica o ocorrido e promete uma resposta quando a engenharia clínica concluir.",
          "explicou o ocorrido e prometeu resposta depois",
          "orientacao",
          70,
          ["comunicacao-cliente"],
          "Explicar ajuda, mas sem a reposição provisória e um horário, o responsável segue sem referência.",
          "O responsável aceitou a explicação, mas cobrou a reposição antes do fim do dia."
        ),
        opcao(
          "Assume a falha, informa o que se sabe e define com ele a reposição provisória e o horário da próxima atualização.",
          "assumiu a falha e definiu reposição e atualização",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Assumir a falha e definir reposição provisória e horário de atualização recupera a confiança do responsável.",
          "O responsável aceitou o combinado e passou a cobrar as atualizações no horário."
        ),
        opcao(
          "Diz que a UTI deveria ter relatado a falha antes.",
          "disse que a UTI deveria ter relatado antes",
          null,
          40,
          ["comunicacao-cliente", "gestao-equipe"],
          "Culpar a UTI esconde que o fluxo de aviso era responsabilidade de quem coordena.",
          "A UTI se sentiu acusada, e a relação com a manutenção esfriou."
        )
      ]
    ),
    no(
      "n4a",
      "fornecedor",
      "O fabricante sugere devolver ao uso hoje os equipamentos verificados, pulando a conferência final da engenharia clínica, “porque o lote é confiável”.",
      "direcao",
      ["materiais-custos", "aplicacao-nr-pop", "decisao-pressao"],
      [
        opcao(
          "Aceita, por confiar no fabricante e pela falta de reposição.",
          "aceitou devolver ao uso sem a conferência final",
          "apoio",
          40,
          ["materiais-custos", "aplicacao-nr-pop"],
          "Confiar no fabricante não dispensa a conferência final da engenharia clínica antes do retorno ao uso.",
          "Os equipamentos voltaram, e a conferência pulada foi apontada como desvio na revisão."
        ),
        opcao(
          "Pede que o fabricante antecipe a conferência e decide o retorno ao uso depois.",
          "pediu antecipar a conferência e decidiu depois",
          "orientacao",
          70,
          ["materiais-custos", "gestao-os"],
          "Pedir a antecipação é bom, mas o retorno ao uso depende da conferência final da engenharia clínica.",
          "A conferência foi antecipada, porém o retorno ao uso ficou sem prazo definido com a UTI."
        ),
        opcao(
          "Exige a conferência final da engenharia clínica antes do retorno ao uso e registra a decisão com o setor.",
          "exigiu a conferência final e registrou a decisão",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "comunicacao-cliente"],
          "Exigir a conferência final e registrar a decisão com a UTI mantém os pacientes protegidos, mesmo com a falta de reposição.",
          "A engenharia clínica fez a conferência, e os equipamentos voltaram com registro e aviso à UTI."
        )
      ],
      "Sem decisão sua, o fabricante devolveu os equipamentos ao uso sem a conferência final."
    ),
    no(
      "n4b",
      "tecnico",
      "A pressão por reposição faz um técnico sugerir usar um equipamento reprovado “só nesta noite”, até chegarem os outros.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-equipe", "decisao-pressao"],
      [
        opcao(
          "Autoriza usar o equipamento reprovado nesta noite, com atenção redobrada da equipe.",
          "autorizou usar o equipamento reprovado",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Autorizar usar um equipamento reprovado num paciente de UTI é o oposto do esperado de quem lidera. Gera alerta vermelho.",
          "A engenharia clínica retirou o equipamento da UTI, a ocorrência foi formalizada e a decisão virou registro de falha."
        ),
        opcao(
          "Recusa o uso do reprovado, explica o motivo e aciona a reposição provisória combinada com a UTI.",
          "recusou o equipamento reprovado e acionou a reposição",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "gestao-equipe"],
          "Equipamento reprovado não volta à UTI: recusar, explicar e acionar a reposição provisória protege os pacientes.",
          "O técnico entendeu o motivo, a reposição provisória foi usada e a noite seguiu sem o equipamento reprovado."
        ),
        opcao(
          "Pede ao técnico que decida com a enfermagem o melhor para a noite.",
          "deixou o técnico decidir com a enfermagem",
          "apoio",
          40,
          ["delegacao", "aplicacao-nr-pop"],
          "A decisão sobre usar um equipamento reprovado é de quem coordena, e não do técnico com a enfermagem.",
          "O técnico e a enfermagem discordaram, e o equipamento ficou num limbo, sem registro de quem decidiu."
        )
      ],
      "Sem decisão sua, o técnico deixou o equipamento reprovado em uso e o fato ficou sem registro."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. Os equipamentos foram verificados e a reposição foi regularizada. A direção quer um relato e saber o que muda no controle dos equipamentos.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe", "aplicacao-nr-pop"],
      [
        opcao(
          "Relata com a linha do tempo, reconhece enfermagem e engenharia clínica e propõe um fluxo de aviso e registro de falhas, com dono e prazo.",
          "relatou, reconheceu as equipes e propôs fluxo de aviso",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Relato claro, reconhecimento das equipes e um fluxo de aviso e registro com dono e prazo previnem a repetição.",
          "A direção aprovou o fluxo, e as próximas falhas passaram a ser registradas e comunicadas na hora."
        ),
        opcao(
          "Diz que foi uma falha comum de equipamento e que não há o que mudar.",
          "disse que foi falha comum de equipamento",
          null,
          40,
          ["comunicacao-cliente"],
          "Tratar como comum o que quase deixou um equipamento defeituoso em uso desperdiça o aprendizado.",
          "A falha de aviso voltou a ocorrer na ocorrência seguinte."
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
      "Fim do dia. A UTI ficou com poucos equipamentos disponíveis e a direção exige explicação. Enfermagem e engenharia clínica divergem sobre quem devia ter avisado.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume parte da falha e promete rever o fluxo de aviso.",
          "assumiu parte da falha e prometeu rever o fluxo",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
          "A direção valorizou a franqueza e pediu um plano concreto para a semana seguinte."
        ),
        opcao(
          "Culpa a enfermagem por não ter relatado a falha antes.",
          "culpou a enfermagem por não relatar antes",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar a enfermagem esconde a falha de coordenação e afasta quem poderia ajudar a corrigir.",
          "A enfermagem se sentiu exposta, e passou a evitar registrar pequenas falhas."
        ),
        opcao(
          "Assume a falha de coordenação, relata a linha do tempo, ouve as equipes e propõe fluxo de aviso e registro com dono e data.",
          "assumiu a falha e propôs fluxo com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir as equipes e propor um fluxo de aviso e registro com dono e data transforma um mau dia em aprendizado.",
          "A direção aceitou o fluxo, e as equipes sentiram que o erro foi tratado sem procurar culpados."
        )
      ]
    )
  ]
});
