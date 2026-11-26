// Leadership Lab — o teste por cenários (a trilha). O teste é uma sequência de cenários de treinamento
// (3, por padrão), escolhidos pelo servidor a partir do público do cadastro da conta. Cada cenário
// roda no <TreinamentoPalco> (cena, 5 perguntas dentro do quadro, tela cheia, desfecho). Entre um
// cenário e o próximo, um resumo do que acabou de acontecer; ao fim, o resultado do teste.
//
// Tudo é do servidor: a tela só mostra o que ele manda (nunca o gabarito) e recarregar retoma na
// primeira pergunta sem resposta. Não há IA no caminho de quem responde.
import type {
  LabCenarioEmAndamento,
  LabConclusaoDoCenario,
  LabTesteProxima
} from "@my-flux/shared";
import { treinoPublicos } from "@my-flux/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Info } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cartao } from "../../features/leadership-lab/componentes/cartao";
import { ErroDaTelaDoLab } from "../../features/leadership-lab/componentes/erro-da-tela";
import { testeApi } from "../../features/leadership-lab/api";
import { descreverErro } from "../../features/leadership-lab/erros";
import { chaves, useProximoDoTeste } from "../../features/leadership-lab/hooks";
import {
  motivoSemTeste,
  nomeDoNivelDoCenario,
  nomeDoPublico
} from "../../features/leadership-lab/rotulos";
import {
  BotaoLink,
  Button,
  CabecalhoDePagina,
  Escalonar,
  LoadingState,
  MensagemDeErro,
  Revelar,
  Select
} from "../../features/leadership-lab/ui";
import { TreinamentoPalco } from "../../features/treinamentos/palco/treinamento-palco";

const VoltarAoPainel = () => (
  <BotaoLink to="/lab" variant="secondary">
    Voltar ao painel
  </BotaoLink>
);

export function LabTrilhaPage() {
  const proxima = useProximoDoTeste();

  if (proxima.isPending) return <LoadingState />;
  if (proxima.isError)
    return (
      <ErroDaTelaDoLab
        erro={descreverErro(proxima.error)}
        aoTentarDeNovo={() => void proxima.refetch()}
        acao={<VoltarAoPainel />}
      />
    );
  return proxima.data.tipo === "cenario" ? (
    <Trilha emAndamento={proxima.data} />
  ) : (
    <SemTeste estado={proxima.data} />
  );
}

// ---------------------------------------------------------------------------
// Antes de começar
// ---------------------------------------------------------------------------

function SemTeste({ estado }: { estado: Extract<LabTesteProxima, { tipo: "sem-teste" }> }) {
  const cliente = useQueryClient();
  const [publico, setPublico] = useState<string>(estado.publico ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ReturnType<typeof descreverErro> | null>(null);
  const escolhe = estado.publicosEscolhiveis.length > 0;
  const motivo = estado.motivo ? motivoSemTeste[estado.motivo] : undefined;

  async function comecar() {
    setErro(null);
    setEnviando(true);
    try {
      const iniciada = await testeApi.iniciar(
        escolhe && publico ? { publico: publico as never } : {}
      );
      cliente.setQueryData(chaves.proximoDoTeste, iniciada);
      void cliente.invalidateQueries({ queryKey: chaves.painel });
    } catch (e) {
      setErro(descreverErro(e));
      setEnviando(false);
    }
  }

  return (
    <Escalonar className="mx-auto max-w-3xl space-y-6">
      <Revelar>
        <CabecalhoDePagina eyebrow="Leadership Lab" titulo="Teste de liderança" />
      </Revelar>
      <Cartao>
        {estado.podeIniciar ? (
          <>
            <h2 className="text-lab-h2 text-lab-tinta">Pronto para começar?</h2>
            <p className="mt-2 text-lab-corpo leading-7 text-lab-tinta-2">
              O teste tem{" "}
              {estado.total > 0 ? (
                <strong>
                  {estado.total} {estado.total === 1 ? "cenário" : "cenários"}
                </strong>
              ) : (
                "alguns cenários"
              )}
              , cada um com 5 decisões. Você vê o que acontece depois de cada escolha. Não há limite
              de tempo, e a ajuda de uma IA não entra nas cenas.
            </p>
            {escolhe ? (
              <div className="mt-4 max-w-md">
                <Select
                  id="publico-do-teste"
                  label="Público do teste"
                  value={publico}
                  onChange={(e) => setPublico(e.target.value)}
                  options={[
                    { value: "", label: "Escolha o público" },
                    ...treinoPublicos.map((p) => ({ value: p, label: nomeDoPublico[p] ?? p }))
                  ]}
                />
                <p className="mt-2 flex items-start gap-2 text-lab-legenda text-lab-tinta-2">
                  <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                  Como DEV, ADMIN ou RH, o seu teste é interno: serve para validar e demonstrar, e
                  não entra nos números dos participantes.
                </p>
              </div>
            ) : estado.publico ? (
              <p className="mt-3 text-lab-pequeno text-lab-tinta-2">
                Público: {nomeDoPublico[estado.publico] ?? estado.publico}
              </p>
            ) : null}
            {erro ? (
              <MensagemDeErro className="mt-4" titulo={erro.titulo}>
                <p className="mt-1">{erro.descricao}</p>
              </MensagemDeErro>
            ) : null}
            <Button
              className="mt-5"
              disabled={enviando || (escolhe && !publico)}
              onClick={() => void comecar()}
              data-testid="comecar-teste"
            >
              {enviando ? "Preparando..." : "Começar o teste"}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-lab-h2 text-lab-tinta">
              {motivo?.titulo ?? "O teste não está disponível"}
            </h2>
            <p className="mt-2 text-lab-corpo leading-7 text-lab-tinta-2">
              {motivo?.descricao ?? "Tente de novo mais tarde."}
            </p>
            <div className="mt-5 flex flex-wrap items-start gap-3">
              {estado.motivo === "teste-legado-em-andamento" ? (
                <>
                  <BotaoLink to="/lab/teste?anterior=1">Retomar o teste anterior</BotaoLink>
                  {escolhe ? <ReiniciarTeste /> : null}
                </>
              ) : null}
              <VoltarAoPainel />
            </div>
          </>
        )}
      </Cartao>
    </Escalonar>
  );
}

/**
 * Só para o teste interno da equipe: encerra o que está aberto (com confirmação) e volta à tela de
 * começar. Se falhar, o teste continua como estava e a mensagem diz o motivo.
 */
function ReiniciarTeste() {
  const cliente = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ReturnType<typeof descreverErro> | null>(null);

  async function reiniciar() {
    setErro(null);
    setEnviando(true);
    try {
      await testeApi.reiniciar();
      void cliente.invalidateQueries({ queryKey: chaves.painel });
      await cliente.resetQueries({ queryKey: chaves.proximoDoTeste });
    } catch (e) {
      setErro(descreverErro(e));
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2">
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Reiniciar teste">
          <p className="text-lab-pequeno text-lab-tinta-2">
            O teste em andamento será encerrado e não volta.
          </p>
          <Button disabled={enviando} onClick={() => void reiniciar()}>
            Sim, encerrar e recomeçar
          </Button>
          <Button variant="ghost" disabled={enviando} onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirmando(true)}>
          Reiniciar teste
        </Button>
      )}
      {erro ? (
        <MensagemDeErro titulo={erro.titulo}>
          <p className="mt-1">{erro.descricao}</p>
        </MensagemDeErro>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Durante: o cenário atual no Palco e o resumo entre os cenários
// ---------------------------------------------------------------------------

type Intervalo = LabConclusaoDoCenario;

function Trilha({ emAndamento }: { emAndamento: LabCenarioEmAndamento }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const [intervalo, setIntervalo] = useState<Intervalo | null>(null);
  const { trilha, cenario, tentativa } = emAndamento;

  if (intervalo?.proximo) {
    const proximo = intervalo.proximo;
    return (
      <Escalonar className="mx-auto max-w-3xl space-y-6">
        <Revelar>
          <CabecalhoDePagina
            eyebrow="Leadership Lab"
            titulo={`Cenário ${intervalo.ordem} de ${trilha.total} concluído`}
          />
        </Revelar>
        <Cartao titulo="O que as suas decisões provocaram">
          <ul className="space-y-3" aria-label="Resultados do cenário">
            {intervalo.desfecho.outcomes.map((o) => (
              <li key={o.id} className="rounded-lab-md border border-lab-borda p-4">
                <p className="flex flex-wrap items-center gap-2 text-lab-pequeno font-semibold text-lab-tinta">
                  {o.label}
                  <span
                    className={
                      o.nivel === "ok"
                        ? "rounded-full bg-lab-sucesso-suave px-2 py-0.5 text-lab-legenda text-lab-sucesso-texto"
                        : o.nivel === "warn"
                          ? "rounded-full bg-lab-aviso-suave px-2 py-0.5 text-lab-legenda text-lab-aviso-texto"
                          : "rounded-full bg-lab-perigo-suave px-2 py-0.5 text-lab-legenda text-lab-perigo-texto"
                    }
                  >
                    {nomeDoNivelDoCenario[o.nivel]}
                  </span>
                </p>
                <p className="mt-1 text-lab-pequeno leading-6 text-lab-tinta-2">{o.texto}</p>
              </li>
            ))}
          </ul>
          <Button
            className="mt-5"
            onClick={() => {
              cliente.setQueryData(chaves.proximoDoTeste, proximo);
              setIntervalo(null);
            }}
            data-testid="proximo-cenario"
          >
            Próximo cenário ({proximo.trilha.atual} de {proximo.trilha.total}){" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </Cartao>
      </Escalonar>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <ol
        aria-label={`Cenário ${trilha.atual} de ${trilha.total}`}
        className="flex flex-wrap items-center gap-2 text-lab-legenda text-lab-tinta-2"
      >
        {trilha.cenarios.map((c) => (
          <li
            key={c.ordem}
            aria-current={c.ordem === trilha.atual ? "step" : undefined}
            className={
              c.ordem === trilha.atual
                ? "rounded-full bg-lab-tinta px-3 py-1 font-semibold text-white"
                : c.status === "concluida"
                  ? "rounded-full bg-lab-sucesso-suave px-3 py-1 text-lab-sucesso-texto"
                  : "rounded-full border border-lab-borda px-3 py-1"
            }
          >
            Cenário {c.ordem}
            {c.status === "concluida" ? " ✓" : ""}
          </li>
        ))}
        {trilha.origem === "interno" ? (
          <li className="rounded-full bg-lab-info-suave px-3 py-1 text-lab-info-texto">
            Teste interno: não entra nos números dos participantes
          </li>
        ) : null}
      </ol>
      {trilha.origem === "interno" ? <ReiniciarTeste /> : null}

      <div className="bg-[#020617]">
        <TreinamentoPalco
          key={tentativa.id}
          cenario={cenario}
          tentativaInicial={{ id: tentativa.id, respostas: tentativa.respostas }}
          eyebrow={`Teste do Leadership Lab · cenário ${trilha.atual} de ${trilha.total}`}
          abrirPelaAbertura
          // A trilha já foi criada pelo servidor: "Iniciar" só abre a cena.
          aoIniciar={async () => ({ id: tentativa.id, respostas: tentativa.respostas })}
          aoResponder={(tentativaId, perguntaId, alternativa) =>
            testeApi.responder(tentativaId, perguntaId, alternativa)
          }
          aoFinalizar={async (tentativaId) => {
            const conclusao = await testeApi.concluir(tentativaId);
            void cliente.invalidateQueries({ queryKey: chaves.painel });
            if (conclusao.resultadoDaSessao) {
              cliente.removeQueries({ queryKey: chaves.proximoDoTeste });
              navegar(`/lab/resultado/${conclusao.resultadoDaSessao}`, { replace: true });
              return;
            }
            setIntervalo(conclusao);
          }}
        />
      </div>
    </div>
  );
}
