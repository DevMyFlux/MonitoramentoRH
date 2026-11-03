// Leadership Lab — o que dizer ao participante quando uma chamada falha.
//
// Função pura: recebe o erro e devolve o texto e o tipo, para a tela decidir o que mostrar (um
// aviso, um botão de tentar de novo, um redirecionamento). Cada código estável da API tem a sua
// frase aqui; um teste confere que nenhum código novo fica sem tratamento.
import type { LabCodigoDeErro } from "@my-flux/shared";
import { ApiError } from "../my-flux/client";
import { RespostaInesperadaError } from "./api";

export type TipoDeErro =
  /** O ambiente não ligou o módulo (a API responde 404 em todas as rotas dele). */
  | "modulo-desligado"
  /** O perfil do usuário não faz os testes. */
  | "sem-acesso"
  /** Usuário COMUM ainda não ligado a um colaborador. */
  | "sem-vinculo"
  /** Não há teste em andamento. */
  | "sem-teste"
  /** O teste foi encerrado, ou não é deste participante. */
  | "teste-indisponivel"
  /** A tela está desatualizada em relação ao servidor: recarregue o estado do teste. */
  | "tela-desatualizada"
  /** Falha passageira: o participante pode tentar de novo. */
  | "tentar-de-novo"
  | "geral";

export type ErroDaTela = {
  tipo: TipoDeErro;
  titulo: string;
  descricao: string;
  podeTentarDeNovo: boolean;
};

const tentarDeNovo = (titulo: string, descricao: string): ErroDaTela => ({
  tipo: "tentar-de-novo",
  titulo,
  descricao,
  podeTentarDeNovo: true
});

const semNovaTentativa = (tipo: TipoDeErro, titulo: string, descricao: string): ErroDaTela => ({
  tipo,
  titulo,
  descricao,
  podeTentarDeNovo: false
});

/** O erro de um código estável do módulo. Os que trazem texto próprio e claro usam o da API. */
function erroDoCodigo(codigo: LabCodigoDeErro, mensagemDaApi: string): ErroDaTela {
  switch (codigo) {
    case "LAB_FORBIDDEN":
      return semNovaTentativa(
        "sem-acesso",
        "O Leadership Lab não é para o seu perfil",
        "Os testes são feitos pelos gestores participantes. Seu perfil não participa deles."
      );
    case "LAB_SEM_VINCULO":
      return semNovaTentativa(
        "sem-vinculo",
        "Seu acesso ainda não está ligado a um colaborador",
        "Peça ao RH para ligar o seu usuário ao seu cadastro de colaborador. Depois disso o Leadership Lab será liberado para você."
      );
    case "LAB_TERMO_PENDENTE":
      return semNovaTentativa(
        "geral",
        "Falta aceitar o termo de ciência",
        "Aceite o termo de ciência para iniciar um teste."
      );
    case "LAB_NOT_FOUND":
      return semNovaTentativa(
        "teste-indisponivel",
        "Não encontramos este teste",
        "Ele não existe ou não é seu. Volte ao painel."
      );
    case "LAB_SEM_TESTE_EM_ANDAMENTO":
      return semNovaTentativa(
        "sem-teste",
        "Você não tem um teste em andamento",
        "Volte ao painel para iniciar um."
      );
    case "LAB_SESSAO_ENCERRADA":
      return semNovaTentativa(
        "teste-indisponivel",
        "Este teste foi encerrado",
        "Ele não aceita mais respostas. Volte ao painel."
      );
    case "LAB_CARGO_NAO_INFORMADO":
    case "LAB_MOLDE_NAO_MAPEADO":
    case "LAB_MOLDE_INATIVO":
    case "LAB_MOLDE_DIVERGENTE":
    case "LAB_LIMITE_DIARIO":
      return semNovaTentativa("geral", "Não foi possível iniciar o teste", mensagemDaApi);
    case "LAB_TURNO_FORA_DE_ORDEM":
    case "LAB_RESPOSTA_DIVERGENTE":
      return semNovaTentativa(
        "tela-desatualizada",
        "A situação mudou",
        "Esta tela estava desatualizada. Vamos mostrar a situação em que você está."
      );
    case "LAB_EM_PROCESSAMENTO":
      return tentarDeNovo(
        "Sua resposta está sendo processada",
        "Aguarde um instante e tente de novo."
      );
    case "LAB_TEMPO_NAO_ESGOTADO":
      return tentarDeNovo("O tempo ainda não acabou", "Continue respondendo: ainda há tempo.");
    case "LAB_TESTE_EM_ANDAMENTO":
      return semNovaTentativa(
        "geral",
        "O resultado ainda não está disponível",
        "Ele aparece depois da última situação do teste."
      );
    case "LAB_IA_INDISPONIVEL":
    case "LAB_IA_RESPOSTA_INVALIDA":
      return tentarDeNovo(
        "O serviço de IA não respondeu",
        "Foi uma falha passageira. Tente de novo em instantes."
      );
  }
}

function ehCodigoDoLab(codigo: string | undefined): codigo is LabCodigoDeErro {
  return codigo !== undefined && codigo.startsWith("LAB_");
}

export function descreverErro(erro: unknown): ErroDaTela {
  if (erro instanceof ApiError) {
    if (ehCodigoDoLab(erro.code)) return erroDoCodigo(erro.code, erro.message);

    // Qualquer 404 sem código do módulo é a rota que não existe: o módulo não está ligado.
    if (erro.status === 404) {
      return semNovaTentativa(
        "modulo-desligado",
        "O Leadership Lab ainda não está ativo",
        "Este ambiente ainda não habilitou o Leadership Lab. Fale com a equipe responsável pelo sistema."
      );
    }
    if (erro.status === 401) {
      return semNovaTentativa(
        "geral",
        "Sua sessão expirou",
        "Entre de novo para continuar de onde parou."
      );
    }
    if (erro.status >= 500) {
      return tentarDeNovo("O sistema não respondeu", "Tente de novo em instantes.");
    }
    return semNovaTentativa("geral", "Não foi possível concluir", erro.message);
  }

  if (erro instanceof RespostaInesperadaError) {
    return tentarDeNovo(
      "Recebemos uma resposta inesperada",
      "Tente de novo. Se o problema continuar, avise a equipe do sistema."
    );
  }

  // fetch rejeitado (sem rede, servidor fora do ar) e tempo esgotado da requisição.
  return tentarDeNovo("Sem conexão com o servidor", "Verifique sua internet e tente de novo.");
}
