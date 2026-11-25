// Assistente de suporte no modo demonstração (sem IA real): respostas prontas, escolhidas pelas
// palavras da pergunta e pela tela em que a pessoa está. Nada sai do servidor.
import type { ConsultaDoSuporte, SuporteIaRequest } from "../ia/ia-contrato.js";

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
  if (pedido.dados) {
    const resultado = pedido.dados.resultado as Record<string, unknown>;
    return `${textoDosDados(pedido.dados.consulta, resultado)}

(Modo demonstração: texto pronto, sem IA real.)`;
  }
  const texto = `${pedido.mensagem} ${pedido.pagina.titulo}`.toLocaleLowerCase("pt-BR");
  const achado = TOPICOS.find((t) => t.chaves.some((c) => texto.includes(c)));
  return `${achado?.resposta ?? PADRAO}\n\n(Modo demonstração: resposta pronta, sem IA real.)`;
}

// ---- Perguntas sobre dados (sem IA real): palavras-chave escolhem a consulta; a API a executa só se
// o perfil puder, e o texto sai de um molde fixo a partir do resultado. ----------------------------

const sem = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

/** Qual consulta a pergunta pede, ou nulo se não for uma pergunta sobre dados. */
export function consultaPedidaPela(mensagem: string): ConsultaDoSuporte | null {
  const m = sem(mensagem);
  if (/(desligad|demitid|saiu|sairam|saidas)/.test(m)) return "desligados_recentes";
  if (/(admitid|admissao|admissoes|contratad|novos colaboradores|entrou|entraram)/.test(m)) {
    return "admissoes_recentes";
  }
  if (/(afastad|ferias|licenca|atestado)/.test(m)) return "afastamentos_atuais";
  if (/(escalas? (recente|gerada|publicada)|ultimas? escalas?)/.test(m)) {
    return "escalas_recentes";
  }
  if (/(quantos|quantas|total de|numero de).*(colaborador|funcionario|pessoas|equipe)/.test(m)) {
    return "resumo_colaboradores";
  }
  return null;
}

type Item = Record<string, unknown>;
const itens = (r: Record<string, unknown>): Item[] =>
  Array.isArray(r.itens) ? (r.itens as Item[]) : [];
const data = (v: unknown) =>
  typeof v === "string" ? v.split("-").reverse().join("/") : "data não registrada";
const lista = (linhas: string[]) =>
  linhas.length ? linhas.map((l) => `- ${l}`).join("\n") : "- (nenhum registro)";

/** O texto de demonstração para o resultado de uma consulta. */
export function textoDosDados(consulta: ConsultaDoSuporte, r: Record<string, unknown>): string {
  switch (consulta) {
    case "resumo_colaboradores": {
      const situacoes = (r.por_situacao ?? {}) as Record<string, number>;
      const detalhe =
        Object.entries(situacoes)
          .map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`)
          .join(", ") || "sem registros";
      return `Hoje há ${String(r.colaboradores_vinculados)} colaboradores vinculados (ativos, afastados ou em férias). Por situação: ${detalhe}.`;
    }
    case "desligados_recentes":
      return `Últimos desligamentos (de ${String(r.total_de_desligados_no_cadastro)} no cadastro):\n${lista(
        itens(r).map(
          (e) =>
            `${String(e.nome)} — ${String(e.funcao ?? "sem função")}, ${String(e.operacao)}, saída em ${data(e.ultimo_dia_de_trabalho)}`
        )
      )}`;
    case "admissoes_recentes":
      return `Admissões mais recentes:\n${lista(
        itens(r).map(
          (e) =>
            `${String(e.nome)} — ${String(e.funcao ?? "sem função")}, ${String(e.operacao)}, admissão em ${data(e.data_de_admissao)}`
        )
      )}`;
    case "afastamentos_atuais":
      return `Afastamentos em curso (${String(r.total_de_afastamentos_em_curso)}):\n${lista(
        itens(r).map((e) => `${String(e.nome)} — ${String(e.motivo)}, até ${data(e.ate)}`)
      )}`;
    case "escalas_recentes":
      return `Escalas mais recentes:\n${lista(
        itens(r).map(
          (e) =>
            `${String(e.operacao)} ${String(e.mes)} (versão ${String(e.versao)}): ${String(e.situacao).replace(/_/g, " ")}`
        )
      )}`;
  }
}
