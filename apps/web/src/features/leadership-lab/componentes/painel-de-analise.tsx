// Leadership Lab — o painel de análise da visão geral do RH: filtros, indicadores com tendência,
// gráficos clicáveis e o detalhamento do que foi escolhido.
//
// Tudo é calculado no navegador sobre a lista de resultados que a API já limita às turmas do
// curador (o DEV vê todas): os filtros só escolhem um pedaço do que ele já pode ver, e a turma do
// filtro só aceita as turmas que a própria API devolveu. Os filtros ficam na URL, para o recorte
// poder ser compartilhado e sobreviver a um recarregamento.
import type { LabItemDaRevisao, LabStatusValidacao } from "@my-flux/shared";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  FilterX,
  Minus,
  TriangleAlert
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "../../../lib/cn";
import { useTurmaEscolhida, useTurmas } from "../cadastro-hooks";
import {
  distribuicaoDaAderencia,
  indiceDaFaixa,
  resultadosPorTeste,
  resumoDosResultados
} from "../visao-geral-dados";
import {
  type FiltrosDaVisaoGeral,
  type Periodo,
  filtrarResultados,
  filtrosPadrao,
  granularidadeDoPeriodo,
  haFiltroAtivo,
  itensDeAtencao,
  opcoesDeParticipante,
  opcoesDeTeste,
  periodos,
  resultadosDoPeriodoAnterior,
  rotulosDoMotivo,
  rotulosDoPeriodo,
  tendenciaDosResultados,
  variacaoEmPontos
} from "../visao-geral-filtros";
import { formatarDataEHora, formatarNumero, nomeDoStatusDeValidacao } from "../rotulos";
import { Revelar, Skeleton } from "../ui";
import { Cartao } from "./cartao";
import { SeloDeValidacao } from "./selo-de-validacao";

// Os dois gráficos vêm do mesmo pacote, carregado uma vez e só quando a tela precisa dele.
let pacoteDosGraficos: Promise<typeof import("./graficos")> | undefined;
const carregarGraficos = () => (pacoteDosGraficos ??= import("./graficos"));
const TendenciaDosResultados = lazy(() =>
  carregarGraficos().then((m) => ({ default: m.TendenciaDosResultados }))
);
const DistribuicaoDeAderencia = lazy(() =>
  carregarGraficos().then((m) => ({ default: m.DistribuicaoDeAderencia }))
);

const statusDoFiltro = ["todos", "aguardando_validacao", "validado", "ajustado"] as const;

// ---------------------------------------------------------------------------
// Filtros na URL
// ---------------------------------------------------------------------------

function lerFiltros(p: URLSearchParams): FiltrosDaVisaoGeral {
  const periodo = p.get("periodo");
  const status = p.get("status");
  return {
    periodo: (periodos as readonly string[]).includes(periodo ?? "")
      ? (periodo as Periodo)
      : filtrosPadrao.periodo,
    turmaId: p.get("turma"),
    teste: p.get("teste"),
    status: (statusDoFiltro as readonly string[]).includes(status ?? "")
      ? (status as FiltrosDaVisaoGeral["status"])
      : "todos",
    participanteId: p.get("participante")
  };
}

function useFiltrosNaUrl() {
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => lerFiltros(params), [params]);
  const mudar = (parcial: Partial<FiltrosDaVisaoGeral>) => {
    const novo = { ...filtros, ...parcial };
    const proximo = new URLSearchParams();
    if (novo.periodo !== filtrosPadrao.periodo) proximo.set("periodo", novo.periodo);
    if (novo.turmaId) proximo.set("turma", novo.turmaId);
    if (novo.teste) proximo.set("teste", novo.teste);
    if (novo.status !== "todos") proximo.set("status", novo.status);
    if (novo.participanteId) proximo.set("participante", novo.participanteId);
    setParams(proximo, { replace: true });
  };
  return { filtros, mudar, limpar: () => setParams(new URLSearchParams(), { replace: true }) };
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

const classeDoSeletor =
  "h-9 min-w-0 max-w-[11rem] cursor-pointer rounded-full border border-lab-linha bg-lab-superficie px-3.5 text-lab-pequeno text-lab-tinta outline-none transition-colors hover:border-lab-linha-forte focus-visible:border-lab-destaque data-[ativo=true]:border-lab-destaque/40 data-[ativo=true]:bg-lab-destaque-suave data-[ativo=true]:text-lab-destaque-texto";

function Seletor({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  todos
}: {
  rotulo: string;
  valor: string | null;
  aoMudar: (v: string | null) => void;
  opcoes: readonly { valor: string; rotulo: string }[];
  todos: string;
}) {
  return (
    <label>
      <span className="sr-only">{rotulo}</span>
      <select
        value={valor ?? ""}
        data-ativo={valor !== null}
        onChange={(e) => aoMudar(e.target.value === "" ? null : e.target.value)}
        className={classeDoSeletor}
      >
        <option value="">{todos}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

function Indicador({
  rotulo,
  valor,
  variacao,
  detalhe
}: {
  rotulo: string;
  valor: string;
  /** Pontos de diferença para o período anterior; nulo esconde a tendência. */
  variacao?: number | null;
  detalhe?: string;
}) {
  const Seta =
    variacao === undefined || variacao === null
      ? null
      : variacao > 0
        ? ArrowUpRight
        : variacao < 0
          ? ArrowDownRight
          : Minus;
  return (
    <div className="min-w-0">
      <dt className="text-lab-legenda text-lab-tinta-2">{rotulo}</dt>
      <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="tabular text-[1.75rem] font-semibold leading-none tracking-[-0.02em] text-lab-tinta">
          {valor}
        </span>
        {Seta && variacao !== undefined && variacao !== null ? (
          <span
            className={cn(
              "tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-lab-legenda font-medium",
              variacao > 0
                ? "bg-lab-sucesso-suave text-lab-sucesso-texto"
                : variacao < 0
                  ? "bg-lab-perigo-suave text-lab-perigo-texto"
                  : "bg-lab-superficie-3 text-lab-tinta-2"
            )}
          >
            <Seta size={12} aria-hidden="true" />
            {variacao > 0 ? "+" : ""}
            {formatarNumero(variacao)} pts
            <span className="sr-only"> em relação ao período anterior</span>
          </span>
        ) : null}
      </dd>
      {detalhe ? <p className="mt-1.5 text-lab-legenda text-lab-tinta-2">{detalhe}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// O painel
// ---------------------------------------------------------------------------

export function PainelDeAnalise({ itens }: { itens: LabItemDaRevisao[] }) {
  const { filtros, mudar, limpar } = useFiltrosNaUrl();
  const turmas = useTurmas();
  // A turma do filtro só vale se a API a devolveu (um id solto na URL não amplia nada).
  const turmaValida =
    filtros.turmaId !== null && turmas.data?.some((t) => t.id === filtros.turmaId)
      ? filtros.turmaId
      : null;
  const turma = useTurmaEscolhida(turmaValida);
  const [faixa, setFaixa] = useState<number | null>(null);
  const [intervalo, setIntervalo] = useState<string | null>(null);
  const agora = useMemo(() => new Date(), []);

  const contexto = useMemo(
    () => ({
      agora,
      participantesDaTurma: turma.data ? new Set(turma.data.participantes.map((p) => p.id)) : null
    }),
    [agora, turma.data]
  );
  // Turma na URL que a API não devolveu: ignorada (não filtra por ela).
  const efetivos = useMemo<FiltrosDaVisaoGeral>(
    () => ({ ...filtros, turmaId: turmaValida }),
    [filtros, turmaValida]
  );

  const filtrados = useMemo(
    () => filtrarResultados(itens, efetivos, contexto),
    [itens, efetivos, contexto]
  );
  const anteriores = useMemo(
    () => resultadosDoPeriodoAnterior(itens, efetivos, contexto),
    [itens, efetivos, contexto]
  );
  const resumo = resumoDosResultados(filtrados);
  const resumoAnterior = anteriores ? resumoDosResultados(anteriores) : null;
  const granularidade = granularidadeDoPeriodo(efetivos.periodo);
  const pontos = useMemo(
    () => tendenciaDosResultados(filtrados, granularidade),
    [filtrados, granularidade]
  );
  const faixas = distribuicaoDaAderencia(filtrados);
  const atencao = useMemo(() => itensDeAtencao(filtrados, agora), [filtrados, agora]);
  const carregandoTurma = turmaValida !== null && turma.isPending;

  // O detalhamento: o que foi escolhido num gráfico, ou tudo o que passou pelos filtros.
  const detalhados = filtrados.filter(
    (i) =>
      (faixa === null || indiceDaFaixa(i.aderenciaGeral) === faixa) &&
      (intervalo === null || tendenciaDoItem(i, granularidade) === intervalo)
  );
  const rotuloDoIntervalo = pontos.find((p) => p.chave === intervalo)?.rotulo;
  const selecao = [
    faixa !== null ? `aderência ${faixas[faixa]?.faixa}` : null,
    rotuloDoIntervalo ? rotuloDoIntervalo : null
  ].filter(Boolean);

  const alternarFaixa = (i: number) => setFaixa((atual) => (atual === i ? null : i));
  const alternarIntervalo = (c: string) => setIntervalo((atual) => (atual === c ? null : c));
  const mudarFiltro = (parcial: Partial<FiltrosDaVisaoGeral>) => {
    setFaixa(null);
    setIntervalo(null);
    mudar(parcial);
  };

  return (
    <>
      <Revelar as="section" aria-label="Filtros" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Período"
            className="inline-flex rounded-full border border-lab-linha bg-lab-superficie p-0.5"
          >
            {periodos.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={efetivos.periodo === p}
                onClick={() => mudarFiltro({ periodo: p })}
                className={cn(
                  "h-8 rounded-full px-3.5 text-lab-pequeno font-medium transition-colors",
                  efetivos.periodo === p
                    ? "bg-lab-tinta text-white"
                    : "text-lab-tinta-2 hover:text-lab-tinta"
                )}
              >
                {rotulosDoPeriodo[p]}
              </button>
            ))}
          </div>
          <Seletor
            rotulo="Turma"
            todos="Todas as turmas"
            valor={turmaValida}
            aoMudar={(v) => mudarFiltro({ turmaId: v })}
            opcoes={(turmas.data ?? []).map((t) => ({ valor: t.id, rotulo: t.nome }))}
          />
          <Seletor
            rotulo="Teste"
            todos="Todos os testes"
            valor={efetivos.teste}
            aoMudar={(v) => mudarFiltro({ teste: v })}
            opcoes={opcoesDeTeste(itens).map((t) => ({ valor: t, rotulo: t }))}
          />
          <Seletor
            rotulo="Situação da validação"
            todos="Qualquer situação"
            valor={efetivos.status === "todos" ? null : efetivos.status}
            aoMudar={(v) => mudarFiltro({ status: (v ?? "todos") as "todos" | LabStatusValidacao })}
            opcoes={(["aguardando_validacao", "validado", "ajustado"] as const).map((s) => ({
              valor: s,
              rotulo: nomeDoStatusDeValidacao[s]
            }))}
          />
          <Seletor
            rotulo="Participante"
            todos="Todos os participantes"
            valor={efetivos.participanteId}
            aoMudar={(v) => mudarFiltro({ participanteId: v })}
            opcoes={opcoesDeParticipante(itens).map((o) => ({ valor: o.id, rotulo: o.nome }))}
          />
          {haFiltroAtivo(efetivos) ? (
            <button
              type="button"
              onClick={() => {
                setFaixa(null);
                setIntervalo(null);
                limpar();
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-lab-pequeno font-medium text-lab-tinta-2 transition-colors hover:bg-lab-tinta/5 hover:text-lab-tinta"
            >
              <FilterX size={14} aria-hidden="true" />
              Limpar filtros
            </button>
          ) : null}
        </div>
        <p role="status" className="text-lab-legenda text-lab-tinta-2">
          {carregandoTurma
            ? "Carregando a turma…"
            : `${filtrados.length} de ${itens.length} ${itens.length === 1 ? "resultado" : "resultados"} nos filtros atuais.`}
        </p>
      </Revelar>

      {filtrados.length === 0 && !carregandoTurma ? (
        <Cartao>
          <div className="py-6 text-center">
            <p className="text-lab-h3 text-lab-tinta">Nenhum resultado com esses filtros</p>
            <p className="mx-auto mt-2 max-w-md text-lab-pequeno text-lab-tinta-2">
              Tente um período maior ou remova algum filtro. Os dados continuam os mesmos: só o
              recorte mudou.
            </p>
            <button
              type="button"
              onClick={limpar}
              className="mt-4 inline-flex h-9 items-center rounded-full bg-lab-tinta px-4 text-lab-pequeno font-medium text-white transition-opacity hover:opacity-90"
            >
              Limpar filtros
            </button>
          </div>
        </Cartao>
      ) : (
        <>
          <Cartao titulo="Indicadores" descricao={rotuloDaComparacao(efetivos.periodo)}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
              <Indicador
                rotulo="Testes concluídos"
                valor={String(resumo.total)}
                detalhe={`${resumo.participantes} ${resumo.participantes === 1 ? "participante" : "participantes"}`}
              />
              <Indicador
                rotulo="Aderência média"
                valor={
                  resumo.aderenciaMedia === null ? "—" : `${formatarNumero(resumo.aderenciaMedia)}%`
                }
                variacao={variacaoEmPontos(
                  resumo.aderenciaMedia,
                  resumoAnterior?.aderenciaMedia ?? null
                )}
              />
              <Indicador
                rotulo="Agilidade média"
                valor={
                  resumo.agilidadeMedia === null ? "—" : `${formatarNumero(resumo.agilidadeMedia)}%`
                }
                variacao={variacaoEmPontos(
                  resumo.agilidadeMedia,
                  resumoAnterior?.agilidadeMedia ?? null
                )}
              />
              <Indicador
                rotulo="Já validados"
                valor={
                  resumo.total === 0
                    ? "—"
                    : `${Math.round((resumo.validados / resumo.total) * 100)}%`
                }
                detalhe={`${resumo.validados} de ${resumo.total}`}
              />
            </dl>
          </Cartao>

          <div className="grid items-start gap-8 xl:grid-cols-2">
            <Cartao
              titulo="Tendência"
              descricao={`Médias por ${granularidade === "dia" ? "dia" : granularidade === "semana" ? "semana" : "mês"}. Clique num ponto para ver os resultados do intervalo.`}
            >
              <Suspense
                fallback={<Skeleton className="h-64 w-full" aria-label="Carregando gráfico" />}
              >
                <TendenciaDosResultados
                  pontos={pontos}
                  selecionada={intervalo}
                  aoSelecionar={alternarIntervalo}
                />
              </Suspense>
              <ul aria-label="Intervalos" className="mt-3 flex flex-wrap gap-1.5">
                {pontos.map((p) => (
                  <li key={p.chave}>
                    <button
                      type="button"
                      aria-pressed={intervalo === p.chave}
                      onClick={() => alternarIntervalo(p.chave)}
                      className={cn(
                        "tabular rounded-full border px-2.5 py-1 text-lab-legenda transition-colors",
                        intervalo === p.chave
                          ? "border-lab-destaque/40 bg-lab-destaque-suave text-lab-destaque-texto"
                          : "border-lab-linha text-lab-tinta-2 hover:border-lab-linha-forte hover:text-lab-tinta"
                      )}
                    >
                      {p.rotulo} · {p.resultados}
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>

            <Cartao
              titulo="Distribuição da aderência"
              descricao="Quantos resultados ficaram em cada faixa. Clique numa barra para detalhar."
            >
              <Suspense
                fallback={<Skeleton className="h-64 w-full" aria-label="Carregando gráfico" />}
              >
                <DistribuicaoDeAderencia
                  faixas={faixas}
                  selecionada={faixa}
                  aoSelecionar={alternarFaixa}
                />
              </Suspense>
              <ul aria-label="Faixas" className="mt-3 flex flex-wrap gap-1.5">
                {faixas.map((f, i) => (
                  <li key={f.faixa}>
                    <button
                      type="button"
                      aria-pressed={faixa === i}
                      onClick={() => alternarFaixa(i)}
                      className={cn(
                        "tabular rounded-full border px-2.5 py-1 text-lab-legenda transition-colors",
                        faixa === i
                          ? "border-lab-destaque/40 bg-lab-destaque-suave text-lab-destaque-texto"
                          : "border-lab-linha text-lab-tinta-2 hover:border-lab-linha-forte hover:text-lab-tinta"
                      )}
                    >
                      {f.faixa} · {f.resultados}
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>
          </div>

          <div className="grid items-start gap-8 xl:grid-cols-3">
            <Cartao
              className="xl:col-span-2"
              titulo={selecao.length > 0 ? `Resultados: ${selecao.join(" · ")}` : "Resultados"}
              descricao={`${detalhados.length} ${detalhados.length === 1 ? "resultado" : "resultados"}${selecao.length > 0 ? " no recorte escolhido nos gráficos" : " nos filtros atuais"}.`}
              acao={
                selecao.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFaixa(null);
                      setIntervalo(null);
                    }}
                    className="inline-flex h-8 items-center rounded-full px-3 text-lab-pequeno font-medium text-lab-tinta-2 transition-colors hover:bg-lab-tinta/5 hover:text-lab-tinta"
                  >
                    Limpar seleção
                  </button>
                ) : null
              }
            >
              {detalhados.length === 0 ? (
                <p className="py-6 text-center text-lab-pequeno text-lab-tinta-2">
                  Nenhum resultado neste recorte.
                </p>
              ) : (
                <div className="rolagem-fina -mx-1 max-h-[26rem] overflow-auto px-1">
                  <table className="w-full min-w-[34rem] text-left text-lab-pequeno">
                    <thead className="sticky top-0 bg-lab-superficie text-lab-legenda text-lab-tinta-2">
                      <tr>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Participante
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Teste
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Aderência
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Situação
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Concluído
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhados.map((i) => (
                        <tr key={i.resultadoId} className="border-t border-lab-linha">
                          <th scope="row" className="py-3 pr-4 font-medium text-lab-tinta">
                            <Link
                              to={`/lab/rh/revisao/${i.resultadoId}`}
                              className="underline-offset-4 hover:text-lab-destaque-texto hover:underline"
                            >
                              {i.participante.nome}
                            </Link>
                          </th>
                          <td className="py-3 pr-4">{i.moldeNome}</td>
                          <td className="tabular py-3 pr-4 font-semibold">
                            {formatarNumero(i.aderenciaGeral)}%
                          </td>
                          <td className="py-3 pr-4">
                            <SeloDeValidacao status={i.statusValidacao} />
                          </td>
                          <td className="tabular py-3 text-lab-tinta-2">
                            {formatarDataEHora(i.concluidaEm)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Cartao>

            <Cartao
              titulo="Pede atenção"
              descricao="Alertas abertos, contestações pendentes e validações paradas há mais de 3 dias."
            >
              {atencao.length === 0 ? (
                <p className="py-4 text-lab-pequeno text-lab-tinta-2">
                  Nada pede atenção nos filtros atuais.
                </p>
              ) : (
                <ul className="-my-1 divide-y divide-lab-linha">
                  {atencao.slice(0, 6).map(({ item, motivos }) => (
                    <li key={item.resultadoId} className="py-3">
                      <Link
                        to={`/lab/rh/revisao/${item.resultadoId}`}
                        className="group block rounded-lab-sm"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-lab-pequeno font-medium text-lab-tinta group-hover:text-lab-destaque-texto">
                            {item.participante.nome}
                          </span>
                          <ArrowRight
                            size={14}
                            aria-hidden="true"
                            className="shrink-0 text-lab-tinta-3 transition-transform group-hover:translate-x-0.5"
                          />
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {motivos.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 rounded-full bg-lab-aviso-suave px-2 py-0.5 text-lab-legenda text-lab-aviso-texto"
                            >
                              <TriangleAlert size={11} aria-hidden="true" />
                              {rotulosDoMotivo[m]}
                            </span>
                          ))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>

          <PorTeste itens={filtrados} />
        </>
      )}
    </>
  );
}

function tendenciaDoItem(i: LabItemDaRevisao, g: ReturnType<typeof granularidadeDoPeriodo>) {
  return tendenciaDosResultados([i], g)[0]?.chave;
}

function rotuloDaComparacao(p: Periodo): string {
  return p === "tudo"
    ? "Sobre todo o período dos resultados que você acompanha."
    : `Últimos ${rotulosDoPeriodo[p]}, com a diferença para os ${rotulosDoPeriodo[p]} anteriores.`;
}

function PorTeste({ itens }: { itens: LabItemDaRevisao[] }) {
  const linhas = resultadosPorTeste(itens);
  if (linhas.length < 2) return null;
  return (
    <Cartao
      titulo="Por teste"
      descricao="As médias de cada teste de cargo, para comparar os grupos."
    >
      <ul className="space-y-4">
        {linhas.map((l) => (
          <li key={l.teste}>
            <div className="flex items-baseline justify-between gap-3 text-lab-pequeno">
              <span className="font-medium text-lab-tinta">{l.teste}</span>
              <span className="tabular text-lab-tinta-2">
                {l.resultados} {l.resultados === 1 ? "resultado" : "resultados"} · agilidade{" "}
                {formatarNumero(l.agilidadeMedia)}%
              </span>
            </div>
            <div
              role="img"
              aria-label={`Aderência média de ${l.teste}: ${formatarNumero(l.aderenciaMedia)}%`}
              className="mt-2 flex items-center gap-3"
            >
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-lab-superficie-3">
                <div
                  className="h-full rounded-full bg-lab-destaque transition-[width] duration-lab-lenta ease-lab"
                  style={{ width: `${Math.max(2, Math.min(100, l.aderenciaMedia))}%` }}
                />
              </div>
              <span className="tabular w-12 text-right text-lab-pequeno font-semibold text-lab-tinta">
                {formatarNumero(l.aderenciaMedia)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
