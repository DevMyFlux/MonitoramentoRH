// Leadership Lab — o acompanhamento unificado do teste por cenários: visão geral, pessoas e cenários,
// com filtros e exportação CSV. Uma tela para RH, ADMIN e DEV; o servidor decide o que cada um vê
// (o RH, só as turmas dele) e a exportação usa os mesmos filtros e o mesmo escopo.
import {
  type LabAcompanhamentoCenario,
  type LabAcompanhamentoPessoa,
  type LabAcompanhamentoResumo,
  niveisDeGovernanca,
  treinoPublicos
} from "@my-flux/shared";
import { Download } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Escalonar,
  Input,
  LoadingState,
  MensagemDeErro,
  NumeroAnimado,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "../../../features/leadership-lab/ui";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import {
  type FiltroDoAcompanhamento,
  labAcompanhamentoApi,
  semFiltros
} from "../../../features/leadership-lab/acompanhamento-api";
import {
  useCenariosDoAcompanhamento,
  usePessoasDoAcompanhamento,
  useResumoDoAcompanhamento
} from "../../../features/leadership-lab/acompanhamento-hooks";
import { Cartao, Estatistica } from "../../../features/leadership-lab/componentes/cartao";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import {
  formatarDataEHora,
  formatarNumero,
  formatarPercentual
} from "../../../features/leadership-lab/rotulos";
import { nomeDoPublico } from "../../treinamentos/config-regras";

const abas = [
  { id: "geral", rotulo: "Visão geral" },
  { id: "pessoas", rotulo: "Pessoas" },
  { id: "cenarios", rotulo: "Cenários" }
] as const;
type AbaId = (typeof abas)[number]["id"];

const nomeDoNivel: Record<(typeof niveisDeGovernanca)[number], string> = {
  assistente: "Assistente",
  supervisor: "Supervisor",
  coordenador: "Coordenador",
  diretoria: "Diretoria"
};

const pct = formatarPercentual;

/** Os filtros vivem na URL: dá para compartilhar o recorte e voltar a ele. */
function useFiltros(): [
  FiltroDoAcompanhamento,
  (mudanca: Partial<FiltroDoAcompanhamento>) => void
] {
  const [params, setParams] = useSearchParams();
  const filtro = Object.fromEntries(
    (Object.keys(semFiltros) as (keyof FiltroDoAcompanhamento)[]).map((k) => [
      k,
      params.get(k) ?? ""
    ])
  ) as FiltroDoAcompanhamento;
  const mudar = (mudanca: Partial<FiltroDoAcompanhamento>) =>
    setParams(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        for (const [k, v] of Object.entries(mudanca)) {
          if (v) novos.set(k, v);
          else novos.delete(k);
        }
        return novos;
      },
      { replace: true }
    );
  return [filtro, mudar];
}

export function LabAcompanhamentoPage() {
  const [params, setParams] = useSearchParams();
  const aba = (abas.find((a) => a.id === params.get("aba"))?.id ?? "geral") as AbaId;
  const [filtro, mudarFiltro] = useFiltros();
  const resumo = useResumoDoAcompanhamento(filtro);

  const trocarAba = (id: AbaId) =>
    setParams(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        novos.set("aba", id);
        return novos;
      },
      { replace: true }
    );

  return (
    <LayoutDoAcompanhamento>
      <p className="max-w-3xl text-lab-pequeno text-lab-tinta-2">
        O teste por cenários em um lugar só: quem começou, quem concluiu, como cada pessoa decidiu e
        quais decisões mais se perdem. Testes internos (de quem testa o sistema) ficam à parte e
        nunca entram nas médias. Um teste cuja contestação foi deferida fica marcado e sai das
        médias.
      </p>

      <Filtros
        filtro={filtro}
        aoMudar={mudarFiltro}
        opcoes={resumo.data?.opcoes ?? { turmas: [], areas: [] }}
      />

      <div role="tablist" aria-label="Visões do acompanhamento" className="flex gap-1">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={aba === a.id}
            onClick={() => trocarAba(a.id)}
            className={
              aba === a.id
                ? "h-10 rounded-lab-md bg-lab-destaque-suave px-4 text-lab-pequeno font-semibold text-lab-destaque-texto"
                : "h-10 rounded-lab-md px-4 text-lab-pequeno font-medium text-lab-tinta-2 hover:bg-lab-superficie-2"
            }
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "geral" ? (
        <VisaoGeral resumo={resumo} />
      ) : aba === "pessoas" ? (
        <Pessoas filtro={filtro} />
      ) : (
        <Cenarios filtro={filtro} />
      )}
    </LayoutDoAcompanhamento>
  );
}

// ---------------------------------------------------------------------------
// Filtros e exportação
// ---------------------------------------------------------------------------

function Filtros({
  filtro,
  aoMudar,
  opcoes
}: {
  filtro: FiltroDoAcompanhamento;
  aoMudar: (m: Partial<FiltroDoAcompanhamento>) => void;
  opcoes: LabAcompanhamentoResumo["opcoes"];
}) {
  const algum = Object.values(filtro).some(Boolean);
  const todos = (rotulo: string) => ({ value: "", label: rotulo });
  return (
    <form
      aria-label="Filtros do acompanhamento"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <Select
        label="Turma"
        name="filtro-turma"
        value={filtro.turmaId}
        onChange={(e) => aoMudar({ turmaId: e.target.value })}
        options={[
          todos("Todas as turmas"),
          ...opcoes.turmas.map((t) => ({ value: t.id, label: t.nome }))
        ]}
      />
      <Select
        label="Público"
        name="filtro-publico"
        value={filtro.publico}
        onChange={(e) => aoMudar({ publico: e.target.value })}
        options={[
          todos("Todos os públicos"),
          ...treinoPublicos.map((p) => ({ value: p, label: nomeDoPublico[p] }))
        ]}
      />
      <Select
        label="Nível"
        name="filtro-nivel"
        value={filtro.nivel}
        onChange={(e) => aoMudar({ nivel: e.target.value })}
        options={[
          todos("Todos os níveis"),
          ...niveisDeGovernanca.map((n) => ({ value: n, label: nomeDoNivel[n] }))
        ]}
      />
      <Select
        label="Área"
        name="filtro-area"
        value={filtro.areaId}
        onChange={(e) => aoMudar({ areaId: e.target.value })}
        options={[
          todos("Todas as áreas"),
          ...opcoes.areas.map((a) => ({ value: a.id, label: a.nome }))
        ]}
      />
      <Input
        label="De"
        name="filtro-de"
        type="date"
        value={filtro.de}
        onChange={(e) => aoMudar({ de: e.target.value })}
      />
      <Input
        label="Até"
        name="filtro-ate"
        type="date"
        value={filtro.ate}
        onChange={(e) => aoMudar({ ate: e.target.value })}
      />
      <Select
        label="Situação"
        name="filtro-status"
        value={filtro.status}
        onChange={(e) => aoMudar({ status: e.target.value })}
        options={[
          todos("Qualquer situação"),
          { value: "em_andamento", label: "Em andamento" },
          { value: "concluida", label: "Concluída" }
        ]}
      />
      <div className="flex items-end gap-2">
        {algum ? (
          <Button variant="secondary" onClick={() => aoMudar({ ...semFiltros })}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function BotaoExportar({
  filtro,
  visao,
  rotulo
}: {
  filtro: FiltroDoAcompanhamento;
  visao: "sessoes" | "cenarios";
  rotulo: string;
}) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="secondary"
        icon={<Download size={16} />}
        loading={exportando}
        onClick={() => {
          setErro(null);
          setExportando(true);
          labAcompanhamentoApi
            .exportar(filtro, visao)
            .catch((e: unknown) =>
              setErro(e instanceof Error ? e.message : "Não foi possível exportar.")
            )
            .finally(() => setExportando(false));
        }}
      >
        {rotulo}
      </Button>
      {erro ? <MensagemDeErro>{erro}</MensagemDeErro> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

function VisaoGeral({ resumo }: { resumo: ReturnType<typeof useResumoDoAcompanhamento> }) {
  const [filtro] = useFiltros();
  if (resumo.isPending) return <LoadingState />;
  if (resumo.isError)
    return (
      <ErroDaTelaDoLab
        erro={descreverErroDoCadastro(resumo.error, "acompanhamento")}
        aoTentarDeNovo={() => void resumo.refetch()}
      />
    );
  const r = resumo.data;
  const { totais, funil } = r;
  const n = (valor: number) => <NumeroAnimado valor={valor} formatar={String} />;
  return (
    <Escalonar className="space-y-8">
      <section aria-label="Totais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Estatistica
          rotulo="Participantes"
          valor={n(totais.participantes)}
          detalhe={`${totais.iniciaram} já iniciaram o teste`}
        />
        <Estatistica
          rotulo="Testes concluídos"
          valor={n(totais.concluidas)}
          detalhe={`${totais.emAndamento} em andamento`}
        />
        <Estatistica
          rotulo="Aderência média"
          valor={totais.aderenciaMedia === null ? "—" : pct(totais.aderenciaMedia)}
          detalhe="% das decisões cumpridas"
        />
        <Estatistica
          rotulo="Agilidade média"
          valor={totais.agilidadeMedia === null ? "—" : pct(totais.agilidadeMedia)}
          detalhe="Tempo de resposta contra a referência"
        />
        <Estatistica
          rotulo="Contestações em aberto"
          valor={n(totais.contestacoesAbertas)}
          para="/lab/rh/contestacoes"
          detalhe="Abertas ou em análise"
        />
      </section>

      <Cartao
        titulo="Funil"
        descricao="Do cadastro ao teste concluído: onde as pessoas ficam pelo caminho."
        acao={<BotaoExportar filtro={filtro} visao="sessoes" rotulo="Exportar sessões (CSV)" />}
      >
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ["Cadastrados", funil.cadastrados],
            ["Iniciaram", funil.iniciaram],
            ["Concluíram", funil.concluiram]
          ].map(([rotulo, valor]) => (
            <li key={rotulo as string} className="rounded-lab-md bg-lab-superficie-2 p-4">
              <p className="text-lab-pequeno text-lab-tinta-2">{rotulo}</p>
              <p className="tabular fonte-display text-2xl font-bold text-lab-tinta">{valor}</p>
              <p className="text-lab-legenda text-lab-tinta-2">
                {funil.cadastrados === 0
                  ? "—"
                  : `${formatarNumero(((valor as number) / funil.cadastrados) * 100)}% dos cadastrados`}
              </p>
            </li>
          ))}
        </ol>
      </Cartao>

      <Cartao titulo="Por turma">
        {r.porTurma.length === 0 ? (
          <EmptyState title="Nenhuma turma" description="Ainda não há turmas ativas no recorte." />
        ) : (
          <Table aria-label="Resultados por turma">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Turma</TableHeaderCell>
                <TableHeaderCell>Participantes</TableHeaderCell>
                <TableHeaderCell>Iniciaram</TableHeaderCell>
                <TableHeaderCell>Concluíram</TableHeaderCell>
                <TableHeaderCell>Aderência média</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {r.porTurma.map((t) => (
                <TableRow key={t.turmaId}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell>{t.participantes}</TableCell>
                  <TableCell>{t.iniciaram}</TableCell>
                  <TableCell>{t.concluiram}</TableCell>
                  <TableCell>{pct(t.aderenciaMedia)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Cartao>

      <Cartao titulo="Por público">
        {r.porPublico.length === 0 ? (
          <EmptyState
            title="Nenhum teste no recorte"
            description="Mude os filtros para ver outros públicos."
          />
        ) : (
          <Table aria-label="Resultados por público">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Público</TableHeaderCell>
                <TableHeaderCell>Testes</TableHeaderCell>
                <TableHeaderCell>Concluídos</TableHeaderCell>
                <TableHeaderCell>Aderência média</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {r.porPublico.map((p) => (
                <TableRow key={p.publico}>
                  <TableCell className="font-medium">{nomeDoPublico[p.publico]}</TableCell>
                  <TableCell>{p.sessoes}</TableCell>
                  <TableCell>{p.concluidas}</TableCell>
                  <TableCell>{pct(p.aderenciaMedia)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Cartao>

      {r.internos.sessoes > 0 ? (
        <p
          role="note"
          className="rounded-lab-md bg-lab-superficie-2 p-4 text-lab-pequeno text-lab-tinta-2"
        >
          Testes internos (de quem testa o sistema): {r.internos.sessoes}, dos quais{" "}
          {r.internos.concluidas} concluídos. Ficam fora das médias, do funil e da comparação com o
          grupo.
        </p>
      ) : null}
    </Escalonar>
  );
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------

function SituacaoDaSessao({ p }: { p: LabAcompanhamentoPessoa }) {
  const u = p.ultima;
  if (!u) return <Badge tone="neutral">Não iniciou</Badge>;
  if (u.contestadoDeferido) return <Badge tone="info">Anulado (contestação deferida)</Badge>;
  return u.status === "concluida" ? (
    <Badge tone="success">Concluída</Badge>
  ) : (
    <Badge tone="warning">Em andamento</Badge>
  );
}

function Pessoas({ filtro }: { filtro: FiltroDoAcompanhamento }) {
  const pessoas = usePessoasDoAcompanhamento(filtro, true);
  if (pessoas.isPending) return <LoadingState />;
  if (pessoas.isError)
    return (
      <ErroDaTelaDoLab
        erro={descreverErroDoCadastro(pessoas.error, "acompanhamento")}
        aoTentarDeNovo={() => void pessoas.refetch()}
      />
    );
  const { pessoas: lista, truncado } = pessoas.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lab-pequeno text-lab-tinta-2">
          {lista.length} {lista.length === 1 ? "pessoa" : "pessoas"} no recorte.
        </p>
        <BotaoExportar filtro={filtro} visao="sessoes" rotulo="Exportar sessões (CSV)" />
      </div>
      {truncado ? (
        <p
          role="note"
          className="rounded-lab-md bg-lab-aviso-suave p-3 text-lab-pequeno text-lab-aviso-texto"
        >
          Há mais pessoas do que a lista mostra. Use os filtros para refinar.
        </p>
      ) : null}
      {lista.length === 0 ? (
        <EmptyState
          title="Ninguém por aqui"
          description="Nenhuma pessoa corresponde aos filtros. Se a lista está vazia sem filtros, confira se há turmas ativas com participantes."
        />
      ) : (
        <Table aria-label="Pessoas do acompanhamento">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Pessoa</TableHeaderCell>
              <TableHeaderCell>Nível · área</TableHeaderCell>
              <TableHeaderCell>Turmas</TableHeaderCell>
              <TableHeaderCell>Último teste</TableHeaderCell>
              <TableHeaderCell>Aderência</TableHeaderCell>
              <TableHeaderCell>Contestações</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.map((p) => (
              <TableRow key={p.participanteId}>
                <TableCell>
                  <Link
                    to={`/lab/rh/acompanhamento/pessoas/${p.participanteId}`}
                    className="font-medium text-lab-destaque-texto hover:underline"
                  >
                    {p.nome}
                  </Link>
                  <span className="block text-lab-legenda text-lab-tinta-2">
                    {p.identificador}
                    {p.cargo ? ` · ${p.cargo}` : ""}
                  </span>
                </TableCell>
                <TableCell>
                  {[p.nivel ? nomeDoNivel[p.nivel] : null, p.area].filter(Boolean).join(" · ") ||
                    "—"}
                </TableCell>
                <TableCell>{p.turmas.join(", ") || "—"}</TableCell>
                <TableCell>
                  <SituacaoDaSessao p={p} />
                  {p.ultima ? (
                    <span className="mt-1 block text-lab-legenda text-lab-tinta-2">
                      {formatarDataEHora(p.ultima.iniciadaEm)}
                      {p.ultima.experimental ? " · experimental" : ""}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{pct(p.ultima?.aderenciaGeral ?? null)}</TableCell>
                <TableCell>{p.contestacoesAbertas > 0 ? p.contestacoesAbertas : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

function CartaoDoCenario({ c }: { c: LabAcompanhamentoCenario }) {
  return (
    <Cartao
      titulo={`${c.titulo} (versão ${c.versao})`}
      descricao={`${c.area}${c.publico ? ` · ${nomeDoPublico[c.publico]}` : ""} · feito ${c.vezes} ${c.vezes === 1 ? "vez" : "vezes"} por ${c.pessoas} ${c.pessoas === 1 ? "pessoa" : "pessoas"} · aderência média ${pct(c.aderenciaMedia)}`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-lab-pequeno font-semibold text-lab-tinta">
            Decisões mais descumpridas
          </h3>
          <ul className="mt-3 space-y-3">
            {c.decisoes.map((d) => (
              <li key={d.id} className="text-lab-pequeno">
                <div className="flex justify-between gap-3">
                  <span className="text-lab-tinta">{d.label}</span>
                  <span className="tabular shrink-0 text-lab-tinta-2">
                    {pct(d.taxaDeDescumprimento)} ({d.descumpridas}/{d.vezes})
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-lab-superficie-3"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-lab-perigo"
                    style={{ width: `${Math.min(100, d.taxaDeDescumprimento)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lab-pequeno font-semibold text-lab-tinta">
            Alternativas mais escolhidas
          </h3>
          <ul className="mt-3 space-y-4">
            {c.perguntas.map((q) => (
              <li key={q.id} className="text-lab-pequeno">
                <p className="font-medium text-lab-tinta">{q.prompt}</p>
                <ol className="mt-1 space-y-1">
                  {q.alternativas.map((a) => (
                    <li key={a.indice} className="flex justify-between gap-3 text-lab-tinta-2">
                      <span>{a.texto}</span>
                      <span className="tabular shrink-0">
                        {a.escolhas} ({pct(a.pct)})
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Cartao>
  );
}

function Cenarios({ filtro }: { filtro: FiltroDoAcompanhamento }) {
  const cenarios = useCenariosDoAcompanhamento(filtro, true);
  if (cenarios.isPending) return <LoadingState />;
  if (cenarios.isError)
    return (
      <ErroDaTelaDoLab
        erro={descreverErroDoCadastro(cenarios.error, "acompanhamento")}
        aoTentarDeNovo={() => void cenarios.refetch()}
      />
    );
  const lista = cenarios.data.cenarios;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lab-pequeno text-lab-tinta-2">
          Os cenários mais difíceis (menor aderência) primeiro. Cada versão aprovada é contada à
          parte.
        </p>
        <BotaoExportar filtro={filtro} visao="cenarios" rotulo="Exportar cenários (CSV)" />
      </div>
      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum cenário feito no recorte"
          description="Quando houver testes concluídos, as decisões mais descumpridas e as alternativas mais escolhidas aparecem aqui."
        />
      ) : (
        <Escalonar className="space-y-6">
          {lista.map((c) => (
            <CartaoDoCenario key={`${c.cenarioId}-${c.versao}`} c={c} />
          ))}
        </Escalonar>
      )}
    </div>
  );
}
