// Cenário: climatização e ventilação. CONTEÚDO DEMONSTRATIVO (pendente de validação técnica e
// pedagógica). Fica no nível gerencial: ninguém aqui diz como consertar um equipamento.
import type { PacoteDaCategoria } from "../tipos.js";

export const climatizacaoVentilacao: PacoteDaCategoria = {
  categoria: {
    id: "climatizacao-ventilacao",
    nome: "Climatização e ventilação",
    descricao: "Ar-condicionado, ventilação e conforto térmico de setores assistenciais.",
    palavrasFortes: [
      "ar condicionado",
      "climatizacao",
      "climatizador",
      "ventilacao",
      "fancoil",
      "fan coil",
      "chiller",
      "split",
      "exaustao",
      "temperatura do setor",
      "hepa"
    ],
    palavrasFracas: ["temperatura", "quente", "calor", "ar", "filtro", "ventilador", "ambiente"],
    exemplos: [
      "Estou com problema para realizar a manutenção do ar-condicionado.",
      "A temperatura do setor está desconfortável e o fan coil parou."
    ]
  },
  cenario: {
    id: "climatizacao-ventilacao",
    categoriaId: "climatizacao-ventilacao",
    versao: "1.0.0-demonstrativo",
    titulo: "Ar-condicionado parado em setor crítico",
    niveis: ["encarregado", "supervisor", "coordenador"],
    aberturas: {
      encarregado:
        "Início do turno. O técnico avisa que o ar-condicionado da UTI adulta parou, e a responsável assistencial já pediu “um jeito rápido”. Você lidera a equipe do turno e há outra ordem urgente aberta. Como começa?",
      supervisor:
        "O ar-condicionado da UTI adulta parou. A responsável assistencial cobra resposta, o fornecedor só atende amanhã e a sua equipe tem duas outras ordens abertas. Você decide como priorizar a equipe e o que comunicar ao setor.",
      coordenador:
        "O ar-condicionado da UTI adulta parou e a diretoria assistencial pede uma posição ainda hoje. O contrato prevê prazos de atendimento, e os seus supervisores estão divididos entre outras demandas. Você responde pela manutenção."
    },
    inicio: "n1",
    fontes: [
      "nhs-htm-03-01",
      "anvisa-rdc-63-2011",
      "anvisa-rdc-7-2010",
      "cdc-controle-ambiental",
      "oms-programas"
    ],
    nos: [
      {
        id: "n1",
        camada: 1,
        personagem: "responsavel-assistencial",
        contexto:
          "O ar-condicionado da UTI adulta parou. A responsável assistencial cobra resposta, o fornecedor só atende amanhã e a sua equipe tem duas outras ordens abertas. Você decide como priorizar a equipe e o que comunicar ao setor.",
        estiloAdequado: "direcao",
        skillsEmJogo: ["gestao-os", "comunicacao-cliente", "decisao-pressao"],
        aoOmitir: "n2b",
        consequenciaOmissao:
          "Sem uma decisão, o chamado ficou parado e o setor passou a cobrar uma resposta.",
        opcoes: {
          A: {
            texto:
              "Alinha com a responsável assistencial, avalia a criticidade e a continuidade do setor e só então define a ação da equipe.",
            resumo: "alinhou com a responsável assistencial antes de agir",
            estilo: "direcao",
            aderencia: 100,
            skills: ["gestao-os", "comunicacao-cliente", "decisao-pressao"],
            justificativa:
              "Alinhar com quem responde pela assistência permite medir o risco real e definir a ação certa, em vez de decidir às cegas.",
            consequencia:
              "A responsável explicou o que o setor suporta, e vocês combinaram a ordem das ações e o que seria comunicado.",
            proximo: "n2a"
          },
          B: {
            texto:
              "Manda o técnico ao local imediatamente, sem alinhar com a assistência, para ganhar tempo.",
            resumo: "mandou o técnico sem alinhar com a assistência",
            estilo: "delegacao",
            aderencia: 40,
            skills: ["gestao-os", "comunicacao-cliente"],
            justificativa:
              "Agir rápido sem conversar com a assistência deixa a criticidade desconhecida e o setor sem informação.",
            consequencia:
              "O técnico começou sem saber o que o setor precisava, e a equipe assistencial soube do problema pelos corredores.",
            proximo: "n2b"
          },
          C: {
            texto:
              "Adia o chamado para o fim do turno e não registra nada, esperando que o setor aguente.",
            resumo: "adiou o chamado sem registrar",
            estilo: null,
            aderencia: 40,
            skills: ["gestao-os", "decisao-pressao"],
            justificativa:
              "Adiar sem registro nem plano deixa o risco invisível: ninguém sabe que o problema existe nem quem responde por ele.",
            consequencia:
              "O chamado ficou sem dono, o setor continuou sem resposta e a responsável acabou ligando para a diretoria.",
            proximo: "n2b"
          }
        }
      },
      {
        id: "n2a",
        camada: 2,
        personagem: "tecnico",
        contexto:
          "Com a criticidade alinhada, o técnico confirma que a correção depende de uma peça que só chega amanhã. A responsável pergunta o que será feito até lá, e a equipe do setor está inquieta.",
        estiloAdequado: "orientacao",
        skillsEmJogo: ["contingencia", "comunicacao-cliente", "gestao-os"],
        aoOmitir: "n3b",
        opcoes: {
          A: {
            texto:
              "Pede ao técnico que registre o diagnóstico e deixa o contato direto com a assistência por conta dele.",
            resumo: "deixou o contato com a assistência por conta do técnico",
            estilo: "delegacao",
            aderencia: 70,
            skills: ["gestao-os", "delegacao"],
            justificativa:
              "Registrar o diagnóstico é correto, mas a comunicação com a assistência é do gestor; delegá-la deixa a conversa sem dono.",
            consequencia:
              "O diagnóstico ficou registrado, mas técnico e enfermagem combinaram medidas diferentes e ninguém soube qual valia.",
            proximo: "n3a"
          },
          B: {
            texto:
              "Monta com a responsável e a engenharia clínica um plano provisório para o setor e registra a decisão e o prazo da peça.",
            resumo: "montou um plano provisório e registrou a decisão",
            estilo: "orientacao",
            aderencia: 100,
            skills: ["contingencia", "comunicacao-cliente", "gestao-os"],
            justificativa:
              "Um plano provisório combinado com quem usa o setor e com a engenharia clínica protege a assistência enquanto a peça não chega.",
            consequencia:
              "O setor passou a seguir um plano claro, e todos souberam o que fazer até a peça chegar.",
            proximo: "n3a"
          },
          C: {
            texto:
              "Garante à responsável que o problema será resolvido ainda hoje, sem confirmar a peça, para acalmar o setor.",
            resumo: "prometeu resolver hoje sem confirmar a peça",
            estilo: null,
            aderencia: 40,
            skills: ["comunicacao-cliente", "decisao-pressao"],
            justificativa:
              "Prometer um prazo que não se pode garantir acalma agora e destrói a confiança quando o prazo falha.",
            consequencia:
              "O setor relaxou por algumas horas. Quando ficou claro que a peça não chegaria, a confiança na manutenção caiu.",
            proximo: "n3b"
          }
        }
      },
      {
        id: "n2b",
        camada: 2,
        personagem: "enfermagem",
        contexto:
          "O problema ficou sem plano. A enfermagem relata desconforto no setor, o técnico pergunta quem decide e a responsável cobra um retorno. Você percebe que a conversa deveria ter vindo antes.",
        estiloAdequado: "direcao",
        skillsEmJogo: ["decisao-pressao", "comunicacao-cliente", "gestao-equipe"],
        aoOmitir: "n3b",
        opcoes: {
          A: {
            texto: "Cobra do técnico que resolva sozinho e rápido, sem dizer nada à assistência.",
            resumo: "cobrou solução rápida do técnico, sem avisar a assistência",
            estilo: "delegacao",
            aderencia: 40,
            skills: ["gestao-equipe", "comunicacao-cliente"],
            justificativa:
              "Cobrar pressa de quem executa, sem resolver a falta de alinhamento, empurra o problema para o técnico.",
            consequencia:
              "O técnico trabalhou sob pressão e sem informação, e a assistência continuou sem saber o que esperar.",
            proximo: "n3b"
          },
          B: {
            texto:
              "Liga para a responsável, assume o atraso na comunicação e combina que o técnico dará o diagnóstico em seguida.",
            resumo: "assumiu o atraso e retomou o contato com a assistência",
            estilo: "orientacao",
            aderencia: 70,
            skills: ["comunicacao-cliente", "gestao-equipe"],
            justificativa:
              "Assumir o atraso e retomar a conversa recupera confiança, mas ainda falta definir quem decide e registrar o ocorrido.",
            consequencia:
              "A responsável aceitou a retomada. O diagnóstico veio no fim da tarde, sem plano definido para a noite.",
            proximo: "n3a"
          },
          C: {
            texto:
              "Assume a decisão: alinha agora com a responsável, define quem decide e o que será comunicado, e registra o ocorrido.",
            resumo: "retomou o controle: alinhou, definiu quem decide e registrou",
            estilo: "direcao",
            aderencia: 100,
            skills: ["decisao-pressao", "comunicacao-cliente", "gestao-os"],
            justificativa:
              "Quando a situação ficou sem dono, a resposta certa é assumir, alinhar, definir responsabilidades e registrar.",
            consequencia:
              "A conversa mudou o clima: o setor soube quem decidia e o técnico passou a trabalhar com clareza.",
            proximo: "n3a"
          }
        }
      },
      {
        id: "n3a",
        camada: 3,
        personagem: "responsavel-assistencial",
        contexto:
          "Meio da tarde. A responsável assistencial pergunta se o setor consegue manter os pacientes e quer ouvir de você, por escrito, os riscos e o plano.",
        estiloAdequado: "orientacao",
        skillsEmJogo: ["comunicacao-cliente", "contingencia"],
        aoOmitir: "n4b",
        opcoes: {
          A: {
            texto:
              "Responde por escrito com o que se sabe, o que não se sabe, o plano provisório e o horário da próxima atualização.",
            resumo: "respondeu por escrito, com plano e horário de atualização",
            estilo: "orientacao",
            aderencia: 100,
            skills: ["comunicacao-cliente", "contingencia"],
            justificativa:
              "Um retorno escrito, honesto sobre o que falta saber e com hora de atualização, dá à assistência o que ela precisa para decidir.",
            consequencia:
              "A responsável usou o texto para orientar a equipe e agradeceu a clareza. A próxima atualização foi cobrada no horário.",
            proximo: "n4a"
          },
          B: {
            texto: "Responde por telefone, resumindo o plano, e promete registrar tudo depois.",
            resumo: "respondeu só por telefone, sem registro",
            estilo: "apoio",
            aderencia: 70,
            skills: ["comunicacao-cliente"],
            justificativa:
              "A conversa ajuda, mas sem registro o que foi combinado se perde e ninguém consegue cobrar nem conferir.",
            consequencia:
              "A conversa foi boa, mas o turno seguinte não soube do que foi combinado e repetiu perguntas.",
            proximo: "n4a"
          },
          C: {
            texto: "Diz que quem sabe é o técnico e a encaminha para ele.",
            resumo: "encaminhou a responsável ao técnico",
            estilo: null,
            aderencia: 40,
            skills: ["comunicacao-cliente", "decisao-pressao"],
            justificativa:
              "Quem coordena é quem responde pela comunicação; repassar a conversa ao técnico foge da responsabilidade.",
            consequencia:
              "O técnico, sem o quadro completo, deu respostas diferentes das suas, e a responsável ficou sem saber em quem confiar.",
            proximo: "n4b"
          }
        }
      },
      {
        id: "n3b",
        camada: 3,
        personagem: "responsavel-assistencial",
        contexto:
          "Meio da tarde. A responsável assistencial diz que o setor está desconfortável e cobra um plano por escrito. Ela comenta que a diretoria já foi avisada.",
        estiloAdequado: "direcao",
        skillsEmJogo: ["comunicacao-cliente", "decisao-pressao"],
        aoOmitir: "n4b",
        opcoes: {
          A: {
            texto: "Pede mais um dia para ter uma resposta definitiva.",
            resumo: "pediu mais um dia sem apresentar plano",
            estilo: null,
            aderencia: 40,
            skills: ["comunicacao-cliente"],
            justificativa:
              "Pedir tempo sem entregar nada deixa a assistência sem plano justamente quando ela mais precisa.",
            consequencia:
              "A responsável não aceitou esperar e levou a cobrança à diretoria, que passou a acompanhar o caso.",
            proximo: "n4b"
          },
          B: {
            texto:
              "Apresenta o que sabe, admite o que não sabe, propõe um plano provisório e marca nova atualização no mesmo dia.",
            resumo: "assumiu o que não sabia e propôs um plano provisório",
            estilo: "direcao",
            aderencia: 100,
            skills: ["comunicacao-cliente", "contingencia", "decisao-pressao"],
            justificativa:
              "Admitir o que falta saber e propor um plano provisório recupera a confiança mesmo depois de um começo ruim.",
            consequencia:
              "A responsável aceitou o plano provisório e passou a confiar nas próximas atualizações.",
            proximo: "n4a"
          },
          C: {
            texto:
              "Oferece ajuda da equipe para amenizar o desconforto, mas deixa o plano para depois.",
            resumo: "ofereceu ajuda ao setor, mas adiou o plano",
            estilo: "apoio",
            aderencia: 70,
            skills: ["gestao-equipe", "comunicacao-cliente"],
            justificativa:
              "Acolher o setor ajuda, mas não substitui o plano que a assistência pediu.",
            consequencia:
              "O setor agradeceu a ajuda, mas voltou a cobrar o plano antes do fim do dia.",
            proximo: "n4a"
          }
        }
      },
      {
        id: "n4a",
        camada: 4,
        personagem: "fornecedor",
        contexto:
          "A peça chegou antes do previsto, mas o fornecedor propõe instalar fora do horário combinado e sem acompanhamento do seu pessoal, para encerrar logo a ordem.",
        estiloAdequado: "direcao",
        skillsEmJogo: ["aplicacao-nr-pop", "gestao-os", "comunicacao-cliente"],
        aoOmitir: "n5b",
        opcoes: {
          A: {
            texto: "Aceita para ganhar tempo e deixa o fornecedor trabalhar como preferir.",
            resumo: "deixou o fornecedor instalar sem acompanhamento",
            estilo: "delegacao",
            aderencia: 40,
            skills: ["aplicacao-nr-pop", "gestao-os"],
            justificativa:
              "Abrir mão do acompanhamento e do horário combinado tira o controle da intervenção num setor sensível.",
            consequencia:
              "O serviço terminou, mas ocorreu sem aviso à assistência e sem registro, e o setor foi surpreendido.",
            proximo: "n5b"
          },
          B: {
            texto: "Aceita o horário, mas pede ao técnico que acompanhe quando puder.",
            resumo: "aceitou o horário e pediu acompanhamento quando possível",
            estilo: "orientacao",
            aderencia: 70,
            skills: ["aplicacao-nr-pop", "gestao-equipe"],
            justificativa:
              "Pedir acompanhamento é bom, mas condicioná-lo à disponibilidade enfraquece o controle do serviço.",
            consequencia:
              "O técnico acompanhou parte do serviço. O fim da instalação ficou sem conferência.",
            proximo: "n5a"
          },
          C: {
            texto:
              "Mantém o horário e o acompanhamento combinados, alinha com a assistência o momento da intervenção e exige o registro do serviço.",
            resumo: "manteve o acompanhamento e alinhou o momento com a assistência",
            estilo: "direcao",
            aderencia: 100,
            skills: ["aplicacao-nr-pop", "comunicacao-cliente", "gestao-os"],
            justificativa:
              "Manter o combinado, avisar a assistência e exigir registro protege o setor e deixa o serviço rastreável.",
            consequencia:
              "A intervenção ocorreu no horário avisado, acompanhada e registrada, sem surpresa para o setor.",
            proximo: "n5a"
          }
        }
      },
      {
        id: "n4b",
        camada: 4,
        personagem: "enfermagem",
        contexto:
          "A pressão aumenta: a enfermeira da noite pergunta por que não houve atualização, e o técnico quer improvisar uma solução fora do procedimento da empresa para “não deixar o setor assim”.",
        estiloAdequado: "direcao",
        skillsEmJogo: ["aplicacao-nr-pop", "contingencia", "decisao-pressao"],
        aoOmitir: "n5b",
        consequenciaOmissao:
          "Sem decisão sua, o técnico improvisou por conta própria e o improviso ficou sem registro.",
        opcoes: {
          A: {
            texto:
              "Proíbe o improviso, explica o motivo, aciona o plano provisório e a engenharia clínica e registra a ocorrência.",
            resumo: "proibiu o improviso e acionou o plano provisório",
            estilo: "direcao",
            aderencia: 100,
            skills: ["aplicacao-nr-pop", "contingencia", "decisao-pressao"],
            justificativa:
              "Sob pressão, segurança e procedimento não se negociam: a decisão firme, explicada e registrada protege setor e equipe.",
            consequencia:
              "O técnico entendeu o motivo, o plano provisório entrou em ação e a enfermagem recebeu uma atualização.",
            proximo: "n5a"
          },
          B: {
            texto: "Agradece a iniciativa e pede cuidado, deixando a decisão com o técnico.",
            resumo: "deixou o improviso a critério do técnico",
            estilo: "apoio",
            aderencia: 40,
            skills: ["aplicacao-nr-pop", "delegacao"],
            justificativa:
              "Elogiar a iniciativa sem impor o procedimento deixa a decisão de risco com quem quer pulá-lo.",
            consequencia:
              "O técnico improvisou com cuidado e nada deu errado, mas o desvio do procedimento ficou sem registro.",
            proximo: "n5b"
          },
          C: {
            texto: "Autoriza o improviso, dizendo que depois se regulariza o registro.",
            resumo: "autorizou o improviso fora do procedimento",
            estilo: "delegacao",
            aderencia: 10,
            linhaVermelha: true,
            skills: ["aplicacao-nr-pop", "decisao-pressao"],
            justificativa:
              "Autorizar fugir do procedimento sob pressão, num setor crítico, é o oposto do esperado de quem lidera. Gera alerta vermelho.",
            consequencia:
              "O improviso agravou o problema, o setor ficou sem o equipamento por mais tempo e o ocorrido virou registro de falha.",
            proximo: "n5b"
          }
        }
      },
      {
        id: "n5a",
        camada: 5,
        personagem: "diretoria",
        contexto:
          "Fim do dia. A situação voltou ao controle. A diretoria pede um relato do que aconteceu e o que muda para evitar repetição.",
        estiloAdequado: "orientacao",
        skillsEmJogo: ["comunicacao-cliente", "gestao-equipe"],
        aoOmitir: null,
        opcoes: {
          A: {
            texto: "Relata os fatos e agradece à equipe, sem propor mudança.",
            resumo: "relatou os fatos, sem propor mudança",
            estilo: "apoio",
            aderencia: 70,
            skills: ["comunicacao-cliente", "gestao-equipe"],
            justificativa:
              "Relatar e reconhecer a equipe é bom, mas faltou transformar o aprendizado numa melhoria concreta.",
            consequencia:
              "A diretoria aceitou o relato e perguntou, na semana seguinte, o que tinha sido feito para evitar repetição.",
            proximo: null
          },
          B: {
            texto:
              "Relata com a linha do tempo, reconhece a equipe e propõe um ajuste de rotina com dono e prazo definidos.",
            resumo: "relatou com linha do tempo e propôs ajuste com dono e prazo",
            estilo: "orientacao",
            aderencia: 100,
            skills: ["comunicacao-cliente", "gestao-equipe", "delegacao"],
            justificativa:
              "Um relato claro, que reconhece a equipe e vira ajuste com dono e prazo, fecha o ciclo e previne repetição.",
            consequencia:
              "A diretoria aprovou o ajuste, a equipe o adotou e o caso virou exemplo de resposta organizada.",
            proximo: null
          },
          C: {
            texto: "Diz que o problema foi isolado e que não há o que mudar.",
            resumo: "disse que não havia o que mudar",
            estilo: null,
            aderencia: 40,
            skills: ["comunicacao-cliente"],
            justificativa:
              "Descartar o aprendizado sem olhar o que ocorreu desperdiça a chance de melhorar a resposta da próxima vez.",
            consequencia:
              "A diretoria aceitou, mas o mesmo tipo de ocorrência voltou a pedir improviso semanas depois.",
            proximo: null
          }
        }
      },
      {
        id: "n5b",
        camada: 5,
        personagem: "diretoria",
        contexto:
          "Fim do dia. O setor segue com a situação instável e a diretoria exige explicação. Parte da equipe sente que ninguém assumiu o problema.",
        estiloAdequado: "orientacao",
        skillsEmJogo: ["comunicacao-cliente", "gestao-equipe"],
        aoOmitir: null,
        opcoes: {
          A: {
            texto: "Aponta o fornecedor e o técnico como responsáveis pelo atraso.",
            resumo: "culpou o fornecedor e o técnico",
            estilo: null,
            aderencia: 40,
            skills: ["gestao-equipe", "comunicacao-cliente"],
            justificativa:
              "Culpar os outros afasta a equipe e esconde a falha de coordenação que levou ao problema.",
            consequencia:
              "A equipe se sentiu exposta, e a diretoria percebeu que o aprendizado não tinha acontecido.",
            proximo: null
          },
          B: {
            texto: "Assume parte da falha, relata os fatos e promete rever a rotina.",
            resumo: "assumiu parte da falha e prometeu rever a rotina",
            estilo: "apoio",
            aderencia: 70,
            skills: ["comunicacao-cliente", "gestao-equipe"],
            justificativa:
              "Assumir a falha é um bom começo, mas uma promessa sem dono nem prazo ainda não corrige a rotina.",
            consequencia:
              "A diretoria valorizou a franqueza e pediu um plano concreto para a semana seguinte.",
            proximo: null
          },
          C: {
            texto:
              "Assume a falha de coordenação, expõe a linha do tempo, ouve a equipe e propõe um plano de correção com responsável e data.",
            resumo: "assumiu a falha e propôs plano de correção com responsável e data",
            estilo: "orientacao",
            aderencia: 100,
            skills: ["comunicacao-cliente", "gestao-equipe", "delegacao"],
            justificativa:
              "Assumir a falha, ouvir a equipe e propor correção com dono e data transforma um mau dia em aprendizado.",
            consequencia:
              "A diretoria aceitou o plano, e a equipe sentiu que o erro foi tratado sem procurar culpados.",
            proximo: null
          }
        }
      }
    ]
  }
};
