import type { LabResultado, LabSituacaoDoResultado } from "@my-flux/shared";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import {
  Badge,
  BotaoLink,
  CabecalhoDePagina,
  Escalonar,
  Expansivel,
  LoadingState,
  NivelEmSegmentos,
  NumeroAnimado,
  Revelar,
  Skeleton
} from "../../features/leadership-lab/ui";
import { cn } from "../../lib/cn";
import { Cartao, Estatistica } from "../../features/leadership-lab/componentes/cartao";
import { ConversaComFacilitador } from "../../features/leadership-lab/componentes/conversa-com-facilitador";
import { ContestarResultado } from "../../features/leadership-lab/componentes/contestar-resultado";
import { ErroDaTelaDoLab } from "../../features/leadership-lab/componentes/erro-da-tela";
import { SeloDeValidacao } from "../../features/leadership-lab/componentes/selo-de-validacao";
import { descreverErro } from "../../features/leadership-lab/erros";
import { useResultado } from "../../features/leadership-lab/hooks";
import {
  formatarDataEHora,
  formatarNumero,
  nomeDoTipoDeSkill
} from "../../features/leadership-lab/rotulos";

// O React Flow só carrega quando o resultado é aberto (fica fora do pacote do painel e do teste).
const MapaDeDecisoes = lazy(() =>
  import("../../features/leadership-lab/componentes/mapa-de-decisoes").then((m) => ({
    default: m.MapaDeDecisoes
  }))
);

const VoltarAoPainel = () => (
  <BotaoLink to="/lab" variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>
    Voltar ao painel
  </BotaoLink>
);

const comoPorcentagem = (n: number) => `${formatarNumero(n)}%`;

export function LabResultadoPage() {
  const { sessaoId = "" } = useParams();
  const resultado = useResultado(sessaoId);

  if (resultado.isPending) return <LoadingState />;
  if (resultado.isError) {
    return (
      <ErroDaTelaDoLab
        erro={descreverErro(resultado.error)}
        aoTentarDeNovo={() => void resultado.refetch()}
        acao={<VoltarAoPainel />}
      />
    );
  }
  return <ResultadoCompleto resultado={resultado.data} />;
}

function ResultadoCompleto({ resultado }: { resultado: LabResultado }) {
  return (
    <Escalonar className="mx-auto max-w-4xl space-y-8">
      <Revelar>
        <CabecalhoDePagina
          eyebrow="Leadership Lab"
          titulo="Resultado do teste"
          acao={<SeloDeValidacao status={resultado.statusValidacao} />}
        >
          {resultado.simulacao ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-lab-pequeno text-lab-tinta">
              <Badge tone="info" className="gap-1">
                <FlaskConical size={12} aria-hidden="true" /> Simulação local
              </Badge>
              {resultado.simulacao.temaNome}: {resultado.simulacao.titulo}
            </p>
          ) : null}
          {resultado.concluidaEm ? (
            <p className="mt-1.5 text-lab-pequeno text-lab-tinta-2">
              Concluído em {formatarDataEHora(resultado.concluidaEm)}
            </p>
          ) : null}
        </CabecalhoDePagina>
      </Revelar>

      {resultado.statusValidacao === "aguardando_validacao" ? (
        <Revelar>
          <p
            role="note"
            className="rounded-lab-lg border border-lab-aviso/20 bg-lab-aviso-suave p-4 text-lab-pequeno leading-6 text-lab-aviso-texto"
          >
            Este resultado ainda será validado pelo RH. Só depois disso ele passa a fazer parte do
            seu histórico oficial.
          </p>
        </Revelar>
      ) : null}

      <section aria-label="Números do teste" className="grid gap-4 sm:grid-cols-3">
        <Estatistica
          rotulo="Aderência geral"
          valor={<NumeroAnimado valor={resultado.aderenciaGeral} formatar={comoPorcentagem} />}
          anel={{ valor: resultado.aderenciaGeral }}
          detalhe="Quanto suas escolhas combinam com o estilo adequado"
        />
        <Estatistica
          rotulo="Agilidade"
          valor={<NumeroAnimado valor={resultado.agilidade} formatar={comoPorcentagem} />}
          anel={{ valor: resultado.agilidade, tom: "info" }}
          detalhe="Quão rápido você decidiu, dentro do tempo"
        />
        <Estatistica rotulo="Situações" valor={resultado.situacoes.length} />
      </section>

      <Cartao titulo="Resumo">
        <p className="text-lab-corpo leading-7 text-lab-tinta">{resultado.resumo}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {resultado.pontoForte ? (
            <div className="rounded-lab-md bg-lab-sucesso-suave p-5">
              <p className="text-lab-legenda font-semibold text-lab-sucesso-texto">Ponto forte</p>
              <p className="mt-1.5 text-lab-pequeno leading-6 text-lab-tinta">
                {resultado.pontoForte}
              </p>
            </div>
          ) : null}
          {resultado.pontoDesenvolvimento ? (
            <div className="rounded-lab-md bg-lab-aviso-suave p-5">
              <p className="text-lab-legenda font-semibold text-lab-aviso-texto">
                Ponto de desenvolvimento
              </p>
              <p className="mt-1.5 text-lab-pequeno leading-6 text-lab-tinta">
                {resultado.pontoDesenvolvimento}
              </p>
            </div>
          ) : null}
        </div>
      </Cartao>

      {resultado.niveisPorSkill.length > 0 ? (
        <Cartao titulo="Nível por skill" descricao="De 1 a 5, nas skills que este teste avaliou.">
          <ul className="divide-y divide-lab-linha">
            {resultado.niveisPorSkill.map((skill) => {
              // O que vale é o nível que o RH validou; antes da validação, o calculado.
              const nivel = skill.nivelValidado ?? skill.nivel;
              const ajustado = skill.nivelValidado !== null && skill.nivelValidado !== skill.nivel;
              return (
                <li
                  key={skill.skillId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3.5"
                >
                  <div>
                    <p className="text-lab-pequeno font-medium text-lab-tinta">{skill.nome}</p>
                    <p className="text-lab-legenda text-lab-tinta-2">
                      {skill.tipo ? `${nomeDoTipoDeSkill[skill.tipo]} · ` : ""}
                      {skill.nEvidencias} {skill.nEvidencias === 1 ? "escolha" : "escolhas"}
                    </p>
                    {ajustado ? (
                      <p className="text-lab-legenda text-lab-aviso-texto">
                        Calculado: {skill.nivel}/5 · ajustado pelo RH na validação
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="sr-only">Nível {nivel} de 5</span>
                    <NivelEmSegmentos nivel={nivel} />
                    <span
                      aria-hidden="true"
                      className="tabular w-8 text-right text-lab-pequeno font-semibold text-lab-tinta"
                    >
                      {nivel}/5
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Cartao>
      ) : null}

      <Cartao
        titulo="Seu mapa de decisões"
        descricao="O caminho que você percorreu, com a consequência de cada escolha e as alternativas que ficaram de fora."
      >
        <Suspense fallback={<Skeleton className="h-[28rem] w-full" aria-label="Carregando mapa" />}>
          <MapaDeDecisoes situacoes={resultado.situacoes} />
        </Suspense>
      </Cartao>

      <Cartao titulo="Suas escolhas, situação por situação">
        <ol className="relative space-y-4">
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[11px] top-6 w-px bg-lab-linha-forte"
          />
          {resultado.situacoes.map((situacao) => (
            <SituacaoDoResultadoItem key={situacao.numero} situacao={situacao} />
          ))}
        </ol>
      </Cartao>

      <ConversaComFacilitador sessaoId={resultado.sessaoId} />

      <ContestarResultado resultado={resultado} />

      {resultado.sugestoes.length > 0 ? (
        <Cartao titulo="Sugestões para você">
          <ul className="space-y-3">
            {resultado.sugestoes.map((sugestao) => (
              <li key={sugestao} className="flex gap-3 text-lab-pequeno leading-6 text-lab-tinta">
                <span
                  aria-hidden="true"
                  className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lab-destaque"
                />
                {sugestao}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      <Revelar>
        <VoltarAoPainel />
      </Revelar>
    </Escalonar>
  );
}

type Tom = "success" | "info" | "warning" | "danger" | "neutral";

function tomDaAderencia(aderencia: number): Tom {
  if (aderencia >= 100) return "success";
  if (aderencia >= 70) return "info";
  if (aderencia >= 40) return "warning";
  if (aderencia > 0) return "danger";
  return "neutral";
}

const corDoMarcador: Record<Tom, string> = {
  success: "bg-lab-sucesso",
  info: "bg-lab-info",
  warning: "bg-lab-aviso",
  danger: "bg-lab-perigo",
  neutral: "bg-lab-tinta-3"
};

/** Uma situação do teste na linha do tempo: o cabeçalho resume, e o cartão abre e fecha. */
function SituacaoDoResultadoItem({ situacao }: { situacao: LabSituacaoDoResultado }) {
  const escolhida = situacao.opcoes.find((o) => o.id === situacao.escolha);
  const tom = tomDaAderencia(situacao.aderencia);
  return (
    <li className="relative pl-10">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-[1.4rem] grid h-6 w-6 place-items-center rounded-full text-[0.6875rem] font-semibold text-white ring-4 ring-lab-superficie",
          corDoMarcador[tom]
        )}
      >
        {situacao.numero}
      </span>
      <Expansivel
        abertoNoInicio
        className="rounded-lab-lg border border-lab-linha bg-lab-superficie-2 p-5"
        cabecalho={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lab-pequeno font-semibold text-lab-tinta">
              Situação {situacao.numero}
            </span>
            {situacao.marco ? <Badge tone="warning">Marco</Badge> : null}
            <Badge tone={tom}>Aderência {formatarNumero(situacao.aderencia)}%</Badge>
            {situacao.tempoRespostaMs !== null ? (
              <span className="text-lab-legenda text-lab-tinta-2">
                respondeu em {formatarNumero(situacao.tempoRespostaMs / 1000)} s
              </span>
            ) : null}
          </span>
        }
      >
        <div className="pt-4">
          <p className="text-lab-pequeno leading-6 text-lab-tinta-2">{situacao.texto}</p>
          <p className="mt-3 text-lab-pequeno text-lab-tinta">
            {situacao.tempoEsgotado || !escolhida ? (
              <span className="font-medium">Sem resposta: o tempo acabou.</span>
            ) : (
              <>
                <span className="font-semibold">Sua escolha ({escolhida.id}):</span>{" "}
                {escolhida.texto}
              </>
            )}
          </p>
          {situacao.justificativa ? (
            <p className="mt-2 text-lab-pequeno leading-6 text-lab-tinta-2">
              {situacao.justificativa}
            </p>
          ) : null}
          {situacao.consequencia ? (
            <p className="mt-3 border-l-2 border-lab-linha-forte pl-3 text-lab-pequeno italic leading-6 text-lab-tinta-2">
              {situacao.consequencia}
            </p>
          ) : null}
        </div>
      </Expansivel>
    </li>
  );
}
