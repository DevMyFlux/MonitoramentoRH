// Assistente de suporte no modo demonstração (sem IA real): respostas prontas, escolhidas pelas
// palavras da pergunta e pela tela em que a pessoa está. Nada sai do servidor.
import type { SuporteIaRequest } from "../ia/ia-contrato.js";

type Topico = { chaves: readonly string[]; resposta: string };

const TOPICOS: readonly Topico[] = [
  {
    chaves: [
      "escala",
      "plantão",
      "plantao",
      "gerar",
      "publicar",
      "aprovar",
      "par",
      "ímpar",
      "impar"
    ],
    resposta:
      "Na tela Escalas você escolhe a operação e o mês e gera a escala. Ela nasce como rascunho: dá para ajustar célula a célula e conferir as pendências. Depois o fluxo é enviar para revisão, aprovar e publicar. Quem enviou não aprova a própria escala (salvo DEV e ADMIN), e qualquer mudança depois do envio pede um novo envio. Pendências impeditivas barram o envio: resolva-as primeiro."
  },
  {
    chaves: [
      "colaborador",
      "funcionário",
      "funcionario",
      "cadastro",
      "cadastrar",
      "afastamento",
      "férias",
      "ferias",
      "exportar"
    ],
    resposta:
      "Na tela Colaboradores você cadastra e edita as pessoas de cada operação, com função, turno e rodízio. Afastamentos (férias, atestados, licenças) entram pelo cadastro do colaborador e passam a bloquear a disponibilidade na escala. A exportação em XLSX traz só os ativos."
  },
  {
    chaves: [
      "teste",
      "lab",
      "leadership",
      "situação",
      "situacao",
      "resultado",
      "facilitador",
      "aprendizagem"
    ],
    resposta:
      "No Leadership Lab, o participante aceita o termo de ciência e faz o teste do molde do seu cargo: cada situação tem tempo e três opções. No fim sai o resultado, que o RH valida. Depois dá para conversar com o facilitador sobre o resultado e usar o espaço de aprendizagem. Durante um teste eu não ajudo com as situações, para não interferir na avaliação."
  },
  {
    chaves: [
      "turma",
      "curador",
      "revisão",
      "revisao",
      "validar",
      "alerta",
      "contestação",
      "contestacao",
      "participante"
    ],
    resposta:
      "O acompanhamento do Lab é a área do RH: cadastre participantes (um login de perfil comum ligado a um colaborador), organize turmas, revise e valide resultados, trate alertas e decida contestações e contribuições. Cada curador vê só as pessoas das turmas que acompanha."
  },
  {
    chaves: ["molde", "configuração", "configuracao", "tempo", "custo", "consumo"],
    resposta:
      "Na Configuração do Lab (ADMIN e DEV) você liga cada molde (encarregado, supervisor, coordenador), define o tempo por situação e os cargos que usam cada um. Ali também fica o consumo e o custo da IA, só em números agregados."
  },
  {
    chaves: ["usuário", "usuario", "senha", "perfil", "acesso", "permissão", "permissao", "login"],
    resposta:
      'Os perfis são DEV, ADMIN, RH e COMUM. O perfil diz o que a pessoa pode fazer e o escopo (empresa, unidade ou operação) diz onde. Contas são criadas na tela Usuários, sempre com perfil abaixo do seu (o DEV pode criar qualquer um). Para recuperar a senha, use "Esqueci a senha" no login.'
  }
];

const PADRAO =
  "Posso ajudar com Colaboradores, Escalas, o Leadership Lab (teste, acompanhamento do RH e configuração) e usuários e perfis. Me diga o que você quer fazer nesta tela que eu explico o passo a passo.";

export function responderComoSuporte(pedido: SuporteIaRequest): string {
  const texto = `${pedido.mensagem} ${pedido.pagina.titulo}`.toLocaleLowerCase("pt-BR");
  const achado = TOPICOS.find((t) => t.chaves.some((c) => texto.includes(c)));
  return `${achado?.resposta ?? PADRAO}\n\n(Modo demonstração: resposta pronta, sem IA real.)`;
}
