import type { LabResultado, LabSituacaoDoResultado } from "@my-flux/shared";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, LoadingState } from "../../components/ui";
import { cn } from "../../lib/cn";
import { Cartao, Estatistica } from "../../features/leadership-lab/componentes/cartao";
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

const VoltarAoPainel = () => (
  <Link to="/lab">
    <Button variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>
      Voltar ao painel
    </Button>
  </Link>
);

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-emerald-800">
            Leadership Lab
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Resultado do teste</h1>
          {resultado.concluidaEm ? (
            <p className="mt-1 text-sm text-slate-500">
              Concluído em {formatarDataEHora(resultado.concluidaEm)}
            </p>
          ) : null}
        </div>
        <SeloDeValidacao status={resultado.statusValidacao} />
      </div>

      {resultado.statusValidacao === "aguardando_validacao" ? (
        <p
          role="note"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Este resultado ainda será validado pelo RH. Só depois disso ele passa a fazer parte do seu
          histórico oficial.
        </p>
      ) : null}

      <section aria-label="Números do teste" className="grid gap-4 sm:grid-cols-3">
        <Estatistica
          rotulo="Aderência geral"
          valor={`${formatarNumero(resultado.aderenciaGeral)}%`}
          detalhe="Quanto suas escolhas combinam com o estilo adequado"
        />
        <Estatistica
          rotulo="Agilidade"
          valor={`${formatarNumero(resultado.agilidade)}%`}
          detalhe="Quão rápido você decidiu, dentro do tempo"
        />
        <Estatistica rotulo="Situações" valor={resultado.situacoes.length} />
      </section>

      <Cartao titulo="Resumo">
        <p className="text-sm leading-6 text-slate-700">{resultado.resumo}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {resultado.pontoForte ? (
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Ponto forte
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-800">{resultado.pontoForte}</p>
            </div>
          ) : null}
          {resultado.pontoDesenvolvimento ? (
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                Ponto de desenvolvimento
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-800">
                {resultado.pontoDesenvolvimento}
              </p>
            </div>
          ) : null}
        </div>
      </Cartao>

      {resultado.niveisPorSkill.length > 0 ? (
        <Cartao titulo="Nível por skill" descricao="De 1 a 5, nas skills que este teste avaliou.">
          <ul className="divide-y divide-slate-100">
            {resultado.niveisPorSkill.map((skill) => {
              // O que vale é o nível que o RH validou; antes da validação, o calculado.
              const nivel = skill.nivelValidado ?? skill.nivel;
              const ajustado = skill.nivelValidado !== null && skill.nivelValidado !== skill.nivel;
              return (
                <li
                  key={skill.skillId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{skill.nome}</p>
                    <p className="text-xs text-slate-500">
                      {skill.tipo ? `${nomeDoTipoDeSkill[skill.tipo]} · ` : ""}
                      {skill.nEvidencias} {skill.nEvidencias === 1 ? "escolha" : "escolhas"}
                    </p>
                    {ajustado ? (
                      <p className="text-xs text-amber-800">
                        Calculado: {skill.nivel}/5 · ajustado pelo RH na validação
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="sr-only">Nível {nivel} de 5</span>
                    <span aria-hidden="true" className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={cn(
                            "h-2 w-4 rounded-sm",
                            n <= nivel ? "bg-emerald-600" : "bg-slate-200"
                          )}
                        />
                      ))}
                    </span>
                    <span
                      aria-hidden="true"
                      className="w-8 text-right text-sm font-semibold text-slate-900"
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

      <Cartao titulo="Suas escolhas, situação por situação">
        <ol className="space-y-4">
          {resultado.situacoes.map((situacao) => (
            <SituacaoDoResultadoItem key={situacao.numero} situacao={situacao} />
          ))}
        </ol>
      </Cartao>

      <ContestarResultado resultado={resultado} />

      {resultado.sugestoes.length > 0 ? (
        <Cartao titulo="Sugestões para você">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {resultado.sugestoes.map((sugestao) => (
              <li key={sugestao}>{sugestao}</li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      <VoltarAoPainel />
    </div>
  );
}

function tomDaAderencia(aderencia: number): "success" | "info" | "warning" | "danger" | "neutral" {
  if (aderencia >= 100) return "success";
  if (aderencia >= 70) return "info";
  if (aderencia >= 40) return "warning";
  if (aderencia > 0) return "danger";
  return "neutral";
}

function SituacaoDoResultadoItem({ situacao }: { situacao: LabSituacaoDoResultado }) {
  const escolhida = situacao.opcoes.find((o) => o.id === situacao.escolha);
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-950">Situação {situacao.numero}</span>
        {situacao.marco ? <Badge tone="warning">Marco</Badge> : null}
        <Badge tone={tomDaAderencia(situacao.aderencia)}>
          Aderência {formatarNumero(situacao.aderencia)}%
        </Badge>
        {situacao.tempoRespostaMs !== null ? (
          <span className="text-xs text-slate-500">
            respondeu em {formatarNumero(situacao.tempoRespostaMs / 1000)} s
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{situacao.texto}</p>
      <p className="mt-3 text-sm text-slate-900">
        {situacao.tempoEsgotado || !escolhida ? (
          <span className="font-medium">Sem resposta: o tempo acabou.</span>
        ) : (
          <>
            <span className="font-semibold">Sua escolha ({escolhida.id}):</span> {escolhida.texto}
          </>
        )}
      </p>
      {situacao.justificativa ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{situacao.justificativa}</p>
      ) : null}
      {situacao.consequencia ? (
        <p className="mt-2 border-l-2 border-slate-200 pl-3 text-sm italic leading-6 text-slate-600">
          {situacao.consequencia}
        </p>
      ) : null}
    </li>
  );
}
