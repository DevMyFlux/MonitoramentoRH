// Leadership Lab — a lógica da tela do teste.
//
// Quem manda no tempo é o servidor: o navegador só mostra a contagem (veja Cronometro) e avisa
// quando ela zera, e o servidor confere. Nada daqui decide se uma resposta valeu.
//
// O estado do teste mora no cache do TanStack Query (`chaves.testeAtual`): carregar, responder e
// declarar tempo esgotado só o atualizam com o que o servidor devolveu. Duas chamadas nunca andam
// juntas: responder e declarar tempo esgotado ao mesmo tempo daria "resposta divergente".
import type { LabEscolha, LabRespostaDeSituacao, LabRespostaDoTeste } from "@my-flux/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ApiError } from "../my-flux/client";
import { labApi } from "./api";
import { type ErroDaTela, descreverErro } from "./erros";
import { type TesteRecebido, chaves, repetirSoSeFalhaPassageira } from "./hooks";

const AVISO_DE_TEMPO_ESGOTADO =
  "O tempo da situação anterior acabou, então ela foi contada como sem resposta.";

type Operacao = () => Promise<LabRespostaDoTeste>;

export function restanteInformadoPeloServidor(erro: unknown): number | null {
  if (!(erro instanceof ApiError) || erro.code !== "LAB_TEMPO_NAO_ESGOTADO") return null;
  const restante = erro.details.tempoRestanteMs;
  return typeof restante === "number" && Number.isFinite(restante) && restante >= 0
    ? restante
    : null;
}

export function useTeste(aoConcluir: (sessaoId: string) => void) {
  const cliente = useQueryClient();
  // Depois de concluir, o teste em andamento deixa de existir: não pode ser lido de novo.
  const [concluido, setConcluido] = useState(false);
  const carga = useQuery({
    queryKey: chaves.testeAtual,
    queryFn: async (): Promise<TesteRecebido> => ({
      resposta: await labApi.testeEmAndamento(),
      recebidaEm: performance.now()
    }),
    enabled: !concluido,
    retry: repetirSoSeFalhaPassageira,
    // O relógio do servidor é a verdade; voltar à aba não precisa reler (o cronômetro é contínuo).
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const [enviando, setEnviando] = useState(false);
  const [tempoAcabou, setTempoAcabou] = useState(false);
  const [erroDeEnvio, setErroDeEnvio] = useState<ErroDaTela | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ocupado = useRef(false);
  const ultima = useRef<Operacao | null>(null);

  const recebido = carga.data ?? null;
  const situacaoAtual: LabRespostaDeSituacao | null =
    recebido?.resposta.tipo === "situacao" ? recebido.resposta : null;

  async function aceitar(resposta: LabRespostaDoTeste) {
    // Uma leitura ainda em voo não pode sobrescrever o que acabou de chegar.
    await cliente.cancelQueries({ queryKey: chaves.testeAtual });
    if (resposta.tipo === "situacao") {
      const novo: TesteRecebido = { resposta, recebidaEm: performance.now() };
      cliente.setQueryData(chaves.testeAtual, novo);
      setTempoAcabou(false);
      setAviso(resposta.tempoEsgotadoNaAnterior ? AVISO_DE_TEMPO_ESGOTADO : null);
      return;
    }
    setConcluido(true);
    cliente.removeQueries({ queryKey: chaves.testeAtual });
    cliente.setQueryData(chaves.resultado(resposta.sessaoId), resposta.resultado);
    void cliente.invalidateQueries({ queryKey: chaves.painel });
    aoConcluir(resposta.sessaoId);
  }

  async function tratarFalha(erro: unknown) {
    // O relógio do navegador adiantou em relação ao do servidor: volta a contar pelo dele.
    const restante = restanteInformadoPeloServidor(erro);
    if (restante !== null) {
      setTempoAcabou(false);
      if (situacaoAtual) {
        const corrigido: TesteRecebido = {
          resposta: {
            ...situacaoAtual,
            situacao: { ...situacaoAtual.situacao, tempoRestanteMs: restante }
          },
          recebidaEm: performance.now()
        };
        cliente.setQueryData(chaves.testeAtual, corrigido);
      }
      return;
    }
    const descricao = descreverErro(erro);
    if (descricao.tipo === "tela-desatualizada") {
      setAviso(descricao.descricao);
      setTempoAcabou(false);
      await cliente.invalidateQueries({ queryKey: chaves.testeAtual });
      return;
    }
    setErroDeEnvio(descricao);
  }

  async function executar(operacao: Operacao) {
    if (ocupado.current) return;
    ocupado.current = true;
    ultima.current = operacao;
    setEnviando(true);
    setErroDeEnvio(null);
    try {
      await aceitar(await operacao());
    } catch (erro) {
      await tratarFalha(erro);
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }

  return {
    carga,
    recebido,
    situacaoAtual,
    enviando,
    tempoAcabou,
    erroDeEnvio,
    aviso,

    /** Envia a escolha. O campo livre só vai se tiver texto. */
    responder: (escolha: LabEscolha, textoLivre: string) => {
      if (!situacaoAtual) return Promise.resolve();
      const { sessaoId, situacao } = situacaoAtual;
      const texto = textoLivre.trim();
      return executar(() =>
        labApi.responder(sessaoId, {
          numero: situacao.numero,
          escolha,
          ...(texto === "" ? {} : { textoLivre: texto })
        })
      );
    },

    /** O cronômetro zerou: o servidor confere se é verdade. */
    declararTempoEsgotado: () => {
      if (!situacaoAtual || ocupado.current) return Promise.resolve();
      setTempoAcabou(true);
      const { sessaoId, situacao } = situacaoAtual;
      return executar(() => labApi.tempoEsgotado(sessaoId, situacao.numero));
    },

    /** Retoma um teste cuja última resposta o servidor guardou mas a IA ainda não avaliou. */
    retomar: () => executar(() => labApi.iniciarTeste()),

    /** Repete a última operação que falhou (é seguro: o servidor reconhece a repetição). */
    tentarDeNovo: () => (ultima.current ? executar(ultima.current) : Promise.resolve())
  };
}
