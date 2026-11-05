// Cenário: gases medicinais e alarmes. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e
// pedagógica). Nível gerencial: ninguém aqui diz como verificar ou consertar uma rede de gases.
import { no, opcao, pacote } from "../construtor.js";

export const gasesMedicinaisAlarmes = pacote({
  categoria: {
    id: "gases-medicinais-alarmes",
    nome: "Gases medicinais e alarmes",
    descricao: "Redes e centrais de gases medicinais, painéis e alarmes de áreas assistenciais.",
    palavrasFortes: [
      "gas medicinal",
      "gases medicinais",
      "oxigenio",
      "oxido nitroso",
      "ar medicinal",
      "central de gases",
      "rede de gases",
      "alarme de gas"
    ],
    palavrasFracas: ["gas", "cilindro", "alarme", "vazamento", "respirador", "painel"],
    exemplos: [
      "O alarme do painel de oxigênio da UTI disparou.",
      "Há um possível vazamento na rede de gases medicinais do centro cirúrgico."
    ]
  },
  titulo: "Alarme da rede de gases na UTI",
  fontes: ["nhs-htm-02-01", "anvisa-rdc-7-2010", "anvisa-rdc-63-2011", "oms-programas"],
  aberturas: [
    "Meio do turno. O painel de alarme de gases da UTI disparou e a enfermagem pede que alguém “resolva o barulho”. O técnico está no andar e espera sua orientação. Você lidera o turno. O que faz primeiro?",
    "O painel de alarme de gases medicinais da UTI disparou. A enfermagem está tensa, há outra urgência na equipe e o responsável assistencial ainda não foi avisado. Você decide a prioridade e quem precisa saber agora.",
    "Um alarme da rede de gases medicinais disparou na UTI e a diretoria assistencial quer saber se há risco. Os seus supervisores têm informações diferentes, e o contrato prevê comunicação imediata de ocorrências. Você coordena a resposta."
  ],
  nos: [
    no(
      "n1",
      "enfermagem",
      "",
      "direcao",
      ["contingencia", "comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Pede ao técnico que verifique o painel e traga um relato antes de avisar qualquer pessoa.",
          "pediu o relato do técnico antes de avisar",
          "orientacao",
          70,
          ["gestao-os", "contingencia"],
          "Conferir o painel é útil, mas o aviso à assistência não pode esperar o relato: o risco é de quem depende do gás.",
          "O relato veio rápido, mas a assistência soube do alarme pelos monitores e ficou sem orientação por alguns minutos."
        ),
        opcao(
          "Aciona o procedimento da instituição para alarme de gases, avisa já o responsável assistencial e envia o técnico acompanhado.",
          "acionou o procedimento e avisou a assistência",
          "direcao",
          100,
          ["contingencia", "comunicacao-cliente", "decisao-pressao"],
          "Num alarme de gases, o primeiro passo é seguir o procedimento e avisar quem responde pelos pacientes, sem esperar certeza.",
          "O responsável assistencial chegou ao setor informado, e a equipe soube o que fazer enquanto o técnico verificava."
        ),
        opcao(
          "Pede que silenciem o alarme para acalmar o setor e verificar depois do turno.",
          "mandou silenciar o alarme para verificar depois",
          null,
          40,
          ["contingencia", "decisao-pressao"],
          "Silenciar o alarme tira o aviso de quem precisa dele e adia a verificação de um risco que ninguém conhece ainda.",
          "O barulho parou, mas a enfermagem ficou insegura e acionou a chefia por conta própria."
        )
      ],
      "Sem decisão sua, o alarme seguiu tocando e a enfermagem acionou a chefia por conta própria."
    ),
    no(
      "n2a",
      "tecnico",
      "O técnico confirma que a causa ainda é desconhecida e pergunta se continua sozinho ou espera a engenharia clínica. A assistência quer saber o que fazer com os pacientes dependentes do gás.",
      "orientacao",
      ["gestao-os", "contingencia", "gestao-equipe"],
      [
        opcao(
          "Orienta o técnico a seguir o procedimento, aciona a engenharia clínica e combina com a assistência o plano de contingência.",
          "orientou o técnico e combinou a contingência",
          "orientacao",
          100,
          ["contingencia", "gestao-equipe", "comunicacao-cliente"],
          "Orientar o técnico, chamar quem tem a competência e combinar a contingência com a assistência protege os pacientes enquanto a causa não se conhece.",
          "O técnico trabalhou com apoio, a engenharia clínica foi acionada e a assistência passou a seguir um plano claro."
        ),
        opcao(
          "Confia na experiência do técnico e pede que avise se encontrar algo grave.",
          "confiou na experiência do técnico",
          "apoio",
          70,
          ["delegacao", "gestao-equipe"],
          "Confiar no técnico é bom, mas a contingência da assistência e o apoio da engenharia clínica não dependem dele.",
          "O técnico seguiu bem, porém a assistência continuou sem plano e a engenharia clínica só soube mais tarde."
        ),
        opcao(
          "Diz à assistência que a situação está sob controle, antes de saber a causa.",
          "disse à assistência que estava sob controle",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "Garantir controle sem conhecer a causa tranquiliza agora e custa a confiança depois.",
          "O setor se acalmou, mas a segurança passada não se sustentou quando a causa apareceu."
        )
      ]
    ),
    no(
      "n2b",
      "responsavel-assistencial",
      "O alarme continua, a enfermagem acionou a chefia por conta própria e o técnico não sabe quem decide. O responsável assistencial chegou ao setor perguntando por que ninguém o avisou.",
      "direcao",
      ["decisao-pressao", "comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Diz ao técnico que a decisão é dele e se afasta do setor.",
          "deixou a decisão com o técnico",
          "delegacao",
          40,
          ["delegacao", "decisao-pressao"],
          "Num momento sem dono, quem coordena precisa assumir, não se afastar.",
          "O técnico ficou exposto diante da chefia, e o setor continuou sem um responsável pela resposta."
        ),
        opcao(
          "Assume a coordenação diante do responsável, aciona o procedimento da instituição e registra o atraso no aviso.",
          "assumiu a coordenação e acionou o procedimento",
          "direcao",
          100,
          ["decisao-pressao", "comunicacao-cliente", "contingencia"],
          "Assumir, acionar o procedimento e registrar o atraso devolve a direção à resposta e preserva a confiança da assistência.",
          "O responsável viu que havia comando: o procedimento foi acionado e o atraso ficou registrado."
        ),
        opcao(
          "Explica ao responsável o que houve, mas deixa o acionamento do procedimento para depois.",
          "explicou o ocorrido e adiou o procedimento",
          "orientacao",
          70,
          ["comunicacao-cliente", "contingencia"],
          "Explicar é necessário, mas o procedimento precisava ser acionado agora, e não depois.",
          "O responsável entendeu a explicação, mas cobrou o acionamento do procedimento ainda no mesmo turno."
        )
      ]
    ),
    no(
      "n3a",
      "responsavel-assistencial",
      "Meio da tarde. O responsável assistencial quer saber se pode manter os pacientes no setor e pede um posicionamento claro, por escrito, antes da troca de plantão.",
      "orientacao",
      ["comunicacao-cliente", "contingencia"],
      [
        opcao(
          "Responde por telefone com o que se sabe e promete enviar o texto no fim do dia.",
          "respondeu por telefone e adiou o texto",
          "apoio",
          70,
          ["comunicacao-cliente"],
          "A conversa ajuda, mas o posicionamento por escrito era o que ele precisava antes da troca de plantão.",
          "O responsável aceitou a conversa, mas a equipe da noite chegou sem o texto e repetiu perguntas."
        ),
        opcao(
          "Diz que a decisão é da engenharia clínica e que ele deve procurá-los.",
          "encaminhou o responsável à engenharia clínica",
          null,
          40,
          ["comunicacao-cliente", "decisao-pressao"],
          "A comunicação com a assistência é de quem coordena; repassá-la a outro setor foge da responsabilidade.",
          "A engenharia clínica, sem o quadro completo, deu respostas diferentes das suas."
        ),
        opcao(
          "Envia por escrito o que se sabe, o que ainda não se sabe, o plano de contingência e o horário da próxima atualização.",
          "enviou posicionamento escrito com plano e atualização",
          "orientacao",
          100,
          ["comunicacao-cliente", "contingencia"],
          "Um posicionamento escrito, honesto sobre o que falta saber e com hora de atualização, dá à assistência o que ela precisa para decidir.",
          "A equipe da noite assumiu o setor informada, e a atualização foi cobrada no horário combinado."
        )
      ]
    ),
    no(
      "n3b",
      "responsavel-assistencial",
      "Meio da tarde. O responsável assistencial diz que a equipe perdeu a confiança na informação recebida e exige um posicionamento claro antes da troca de plantão.",
      "direcao",
      ["comunicacao-cliente", "decisao-pressao"],
      [
        opcao(
          "Assume a falha de comunicação, apresenta o que se sabe e define com ele quem decide e quando haverá atualização.",
          "assumiu a falha e definiu quem decide",
          "direcao",
          100,
          ["comunicacao-cliente", "decisao-pressao", "contingencia"],
          "Assumir a falha e definir quem decide e quando haverá atualização é o que recupera a confiança depois de um começo ruim.",
          "O responsável aceitou o combinado e passou a confiar nas próximas atualizações."
        ),
        opcao(
          "Sugere que a assistência espere o diagnóstico completo para então decidir.",
          "pediu que a assistência esperasse o diagnóstico",
          null,
          40,
          ["comunicacao-cliente"],
          "Pedir que a assistência espere, sem plano nenhum, deixa os pacientes expostos à incerteza.",
          "A assistência não esperou, tomou decisões por conta própria e levou a queixa à diretoria."
        ),
        opcao(
          "Apresenta o que se sabe, mas deixa para a engenharia clínica dizer quando haverá atualização.",
          "apresentou o que sabia, sem horário de atualização",
          "orientacao",
          70,
          ["comunicacao-cliente", "contingencia"],
          "Apresentar os fatos ajuda, mas sem hora de atualização a assistência continua sem referência.",
          "O responsável aceitou os fatos, mas voltou a cobrar um horário antes do fim do plantão."
        )
      ]
    ),
    no(
      "n4a",
      "engenharia-clinica",
      "A engenharia clínica sugere fazer a intervenção na troca de plantão, para “não atrapalhar o dia”. A equipe da noite ainda não foi informada e há pacientes dependentes no setor.",
      "direcao",
      ["aplicacao-nr-pop", "gestao-os", "contingencia"],
      [
        opcao(
          "Concorda e pede que a engenharia avise a equipe da noite quando puder.",
          "concordou e deixou o aviso para depois",
          "delegacao",
          40,
          ["aplicacao-nr-pop", "gestao-os"],
          "Concordar sem garantir o aviso à equipe da noite tira o controle da intervenção num setor sensível.",
          "A intervenção começou sem aviso e a equipe da noite foi surpreendida durante a passagem."
        ),
        opcao(
          "Define o horário junto com a assistência, garante o aviso à equipe da noite e exige o registro da intervenção.",
          "definiu horário com a assistência e exigiu registro",
          "direcao",
          100,
          ["aplicacao-nr-pop", "comunicacao-cliente", "gestao-os"],
          "Combinar o horário com quem usa o setor, avisar a noite e registrar protege os pacientes e deixa o serviço rastreável.",
          "A intervenção ocorreu no horário combinado, sem surpresa, e ficou registrada."
        ),
        opcao(
          "Aceita o horário e pede que a equipe da noite seja informada na passagem de plantão.",
          "aceitou o horário e adiou o aviso à noite",
          "orientacao",
          70,
          ["gestao-os", "comunicacao-cliente"],
          "Informar na passagem é melhor que não informar, mas a assistência devia ter participado da escolha do horário.",
          "A noite foi informada na passagem, porém reclamou de não ter sido consultada."
        )
      ]
    ),
    no(
      "n4b",
      "tecnico",
      "A pressão cresce: para encerrar logo, o técnico propõe liberar o setor antes de a engenharia clínica concluir a verificação, dizendo que “sempre foi assim”.",
      "direcao",
      ["aplicacao-nr-pop", "decisao-pressao", "contingencia"],
      [
        opcao(
          "Libera o setor para usar a rede, porque o técnico tem experiência e o setor precisa voltar ao normal.",
          "liberou o setor antes da verificação concluir",
          "delegacao",
          10,
          ["aplicacao-nr-pop", "decisao-pressao"],
          "Liberar um setor crítico antes da verificação, para encerrar logo, é o oposto do que se espera de quem lidera. Gera alerta vermelho.",
          "A liberação precipitada obrigou a refazer a verificação com o setor já em uso, e a ocorrência virou registro de falha."
        ),
        opcao(
          "Mantém a verificação completa, explica o motivo ao técnico e ao setor e mantém o plano de contingência.",
          "manteve a verificação e a contingência",
          "direcao",
          100,
          ["aplicacao-nr-pop", "decisao-pressao", "contingencia"],
          "Sob pressão, segurança e procedimento não se negociam: manter a verificação e explicar o motivo protege setor e equipe.",
          "O técnico entendeu o motivo, a verificação foi concluída e a assistência recebeu a atualização prometida."
        ),
        opcao(
          "Pede cuidado ao técnico e deixa a liberação do setor com ele.",
          "deixou a liberação do setor com o técnico",
          "apoio",
          40,
          ["aplicacao-nr-pop", "delegacao"],
          "Pedir cuidado não substitui a decisão de quem coordena: a liberação de um setor crítico não é do técnico sozinho.",
          "A liberação aconteceu sem registro claro de quem decidiu, e o desvio apareceu na revisão do dia."
        )
      ],
      "Sem decisão sua, o técnico liberou o setor por conta própria e o desvio ficou sem registro."
    ),
    no(
      "n5a",
      "diretoria",
      "Fim do dia. A ocorrência foi controlada. A diretoria pede um relato do que aconteceu e o que muda para o próximo alarme.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Relata com a linha do tempo, reconhece quem agiu bem e propõe um ajuste no aviso de alarmes, com dono e prazo.",
          "relatou, reconheceu a equipe e propôs ajuste com dono e prazo",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Um relato claro, que reconhece a equipe e vira ajuste com dono e prazo, fecha o ciclo e previne repetição.",
          "A diretoria aprovou o ajuste e o caso virou exemplo de resposta organizada."
        ),
        opcao(
          "Relata os fatos e elogia a equipe, sem propor mudança.",
          "relatou os fatos sem propor mudança",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Relatar e elogiar é bom, mas faltou transformar o aprendizado numa melhoria concreta.",
          "A diretoria aceitou o relato e, na semana seguinte, perguntou o que tinha mudado."
        ),
        opcao(
          "Diz que foi alarme falso e que não há nada a registrar.",
          "disse que foi alarme falso",
          null,
          40,
          ["comunicacao-cliente"],
          "Descartar o registro sem olhar o que ocorreu desperdiça a chance de melhorar a resposta seguinte.",
          "Sem registro, o mesmo tipo de alarme voltou a gerar confusão semanas depois."
        )
      ]
    ),
    no(
      "n5b",
      "diretoria",
      "Fim do dia. A ocorrência não ficou bem registrada e a diretoria cobra explicações. Parte da equipe acha que ninguém assumiu a coordenação.",
      "orientacao",
      ["comunicacao-cliente", "gestao-equipe"],
      [
        opcao(
          "Assume parte da falha e promete uma revisão do aviso de alarmes.",
          "assumiu parte da falha e prometeu revisão",
          "apoio",
          70,
          ["comunicacao-cliente", "gestao-equipe"],
          "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
          "A diretoria valorizou a franqueza e pediu um plano concreto para a semana seguinte."
        ),
        opcao(
          "Aponta o técnico e a engenharia clínica como responsáveis.",
          "culpou o técnico e a engenharia clínica",
          null,
          40,
          ["gestao-equipe", "comunicacao-cliente"],
          "Culpar os outros afasta a equipe e esconde a falha de coordenação que levou ao problema.",
          "As equipes se sentiram expostas, e a diretoria percebeu que o aprendizado não tinha acontecido."
        ),
        opcao(
          "Assume a falha de coordenação, relata a linha do tempo, ouve a equipe e propõe correção com dono e data.",
          "assumiu a falha e propôs correção com dono e data",
          "orientacao",
          100,
          ["comunicacao-cliente", "gestao-equipe", "delegacao"],
          "Assumir a falha, ouvir a equipe e propor correção com dono e data transforma um mau dia em aprendizado.",
          "A diretoria aceitou o plano, e as equipes sentiram que o erro foi tratado sem procurar culpados."
        )
      ]
    )
  ]
});
