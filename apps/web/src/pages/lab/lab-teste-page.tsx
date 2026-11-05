import { labSituacaoDoMarco } from "@my-flux/shared";
import { Link, useNavigate } from "react-router-dom";
import { Button, LoadingState } from "../../components/ui";
import { Cartao } from "../../features/leadership-lab/componentes/cartao";
import { ConsequenciaDaEscolha } from "../../features/leadership-lab/componentes/consequencia-da-escolha";
import { Cronometro } from "../../features/leadership-lab/componentes/cronometro";
import { ErroDaTelaDoLab } from "../../features/leadership-lab/componentes/erro-da-tela";
import { MapaDoCaminho } from "../../features/leadership-lab/componentes/mapa-do-caminho";
import { SituacaoDoTeste } from "../../features/leadership-lab/componentes/situacao-do-teste";
import { descreverErro } from "../../features/leadership-lab/erros";
import { useTeste } from "../../features/leadership-lab/use-teste";

const VoltarAoPainel = () => (
  <Link to="/lab">
    <Button variant="secondary">Voltar ao painel</Button>
  </Link>
);

/**
 * A tela do teste. Mostra só o que o servidor manda durante o teste: a situação, as opções, a
 * consequência da escolha anterior e o tempo. Nunca a aderência: ela só existe no resultado.
 */
export function LabTestePage() {
  const navigate = useNavigate();
  const teste = useTeste((sessaoId) => navigate(`/lab/resultado/${sessaoId}`, { replace: true }));
  const { recebido, situacaoAtual } = teste;

  if (!recebido) {
    if (teste.carga.isError) {
      return (
        <ErroDaTelaDoLab
          erro={descreverErro(teste.carga.error)}
          aoTentarDeNovo={() => void teste.carga.refetch()}
          acao={<VoltarAoPainel />}
        />
      );
    }
    return <LoadingState />;
  }

  if (recebido.resposta.tipo === "em-processamento") {
    const { numero } = recebido.resposta;
    return (
      <Cartao titulo="Sua resposta foi guardada">
        <p className="text-sm leading-6 text-slate-600">
          Você respondeu a situação {numero}, mas ainda não conseguimos processá-la. Sua resposta
          não se perde: continue o teste para o sistema tentar de novo.
        </p>
        {teste.erroDeEnvio ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {teste.erroDeEnvio.titulo}. {teste.erroDeEnvio.descricao}
          </p>
        ) : null}
        <Button className="mt-4" disabled={teste.enviando} onClick={() => void teste.retomar()}>
          {teste.enviando ? "Continuando..." : "Continuar teste"}
        </Button>
      </Cartao>
    );
  }

  if (!situacaoAtual) return <LoadingState />;
  const { situacao, totalSituacoes } = situacaoAtual;
  const bloqueado = teste.enviando || teste.tempoAcabou;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-emerald-800">
          Leadership Lab
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Teste de liderança</h1>
      </div>

      <Cartao>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-[14rem] flex-1">
            <MapaDoCaminho
              total={totalSituacoes}
              atual={situacao.numero}
              marco={labSituacaoDoMarco}
            />
          </div>
          <Cronometro
            key={situacao.numero}
            restanteMs={situacao.tempoRestanteMs}
            limiteMs={situacao.tempoLimiteS * 1000}
            recebidaEm={recebido.recebidaEm}
            aoZerar={() => void teste.declararTempoEsgotado()}
          />
        </div>
      </Cartao>

      {teste.aviso ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {teste.aviso}
        </p>
      ) : null}

      {situacao.consequencia ? (
        <ConsequenciaDaEscolha key={situacao.numero} texto={situacao.consequencia} />
      ) : null}

      <Cartao>
        <SituacaoDoTeste
          key={situacao.numero}
          situacao={situacao}
          desabilitado={bloqueado}
          enviando={teste.enviando}
          aoConfirmar={(escolha, texto) => void teste.responder(escolha, texto)}
        />
        {teste.tempoAcabou && teste.enviando ? (
          <p role="status" className="mt-4 text-sm text-slate-600">
            O tempo acabou. Registrando...
          </p>
        ) : teste.enviando ? (
          <p role="status" className="mt-4 text-sm text-slate-600">
            Enviando sua resposta...
          </p>
        ) : null}
        {teste.erroDeEnvio ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-semibold">{teste.erroDeEnvio.titulo}</p>
            <p className="mt-1">{teste.erroDeEnvio.descricao}</p>
            {teste.erroDeEnvio.podeTentarDeNovo ? (
              <>
                <p className="mt-1 text-xs">Reenviar a mesma resposta é seguro.</p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  onClick={() => void teste.tentarDeNovo()}
                >
                  Tentar de novo
                </Button>
              </>
            ) : (
              <div className="mt-3">
                <VoltarAoPainel />
              </div>
            )}
          </div>
        ) : null}
      </Cartao>
    </div>
  );
}
