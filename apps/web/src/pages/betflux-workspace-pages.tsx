import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Upload, Save, Send, RefreshCw } from "lucide-react";
import { Button } from "../components/ui";
import { apiGet } from "../services/api-client";
import { formatCurrencyFromCents, formatOdd, formatPercent } from "../features/betting/engine";
import {
  MarketPage,
  Frame,
  Section,
  Stat,
  Notice,
  MarketControls,
  CandidateList,
  SimulateButton,
  inputClass,
  linkClass
} from "../features/betting/market-workspace";
import { selectionLabel } from "../features/betting/selection-label";
import { useMarketData, oddsError } from "../features/betting/use-market-data";
import {
  buildAccumulatorSuggestion,
  buildTopMarketCandidates,
  type AccumulatorSuggestion
} from "../features/betting/daily-recommendation";
import { fetchUpcomingOdds } from "../features/betting/odds-api-client";
import {
  loadPaperBets,
  savePaperBets,
  calculatePaperBetPnl,
  type PaperBetStatus
} from "../features/betting/paper-betting-store";
import { usePreferences, savePreferences } from "../features/betting/preferences";
import { localStart, saoPauloDate } from "../features/betting/dates";

export function LivePage() {
  return <MarketPage mode="live" />;
}
export function AccumulatorsPage() {
  return <MarketPage mode="accumulator" />;
}

export function ManualAnalysisPage() {
  const [odd, setOdd] = useState("");
  const [probability, setProbability] = useState("");
  const [amount, setAmount] = useState("");
  const price = Number(odd),
    p = Number(probability) / 100,
    stake = Number(amount);
  const validOdd = Number.isFinite(price) && price > 1;
  const validProbability = probability !== "" && Number.isFinite(p) && p > 0 && p < 1;
  return (
    <Frame title="Analise manual">
      <div className="grid gap-4 sm:grid-cols-3">
        <Numeric label="Odd decimal" value={odd} onChange={setOdd} min={1.01} />
        <Numeric
          label="Sua estimativa de probabilidade (%)"
          value={probability}
          onChange={setProbability}
          min={0.01}
          max={99.99}
        />
        <Numeric label="Valor hipotetico (R$)" value={amount} onChange={setAmount} min={0.01} />
      </div>
      {(odd && !validOdd) || (probability && !validProbability) ? (
        <Notice error>
          Odd deve ser maior que 1. Probabilidade deve estar entre 0 e 100%, sem incluir os
          extremos.
        </Notice>
      ) : null}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Probabilidade implicita" value={validOdd ? formatPercent(1 / price) : "-"} />
        <Stat
          label="Odd justa da sua estimativa"
          value={validProbability ? formatOdd(1 / p) : "-"}
        />
        <Stat
          label="EV hipotetico"
          value={validOdd && validProbability ? formatPercent(p * price - 1) : "-"}
        />
        <Stat
          label="Retorno bruto se acertar"
          value={
            validOdd && Number.isFinite(stake) && stake > 0
              ? formatCurrencyFromCents(Math.round(stake * price * 100))
              : "-"
          }
        />
      </div>
      <Notice>
        O EV depende exclusivamente da probabilidade informada por voce. Um numero positivo aqui nao
        valida a estimativa nem constitui recomendacao de aposta.
      </Notice>
    </Frame>
  );
}

export function TicketUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );
  return (
    <Frame title="Conferir bilhete">
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded border border-dashed border-slate-600 p-5">
        <Upload size={28} className="text-emerald-300" />
        <span className="text-sm">{file?.name ?? "Selecionar bilhete PNG ou JPG (ate 10 MB)"}</span>
        <input
          aria-label="Imagem do bilhete"
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (!next) return;
            if (!["image/png", "image/jpeg"].includes(next.type) || next.size > 10 * 1024 * 1024) {
              setError("Selecione uma imagem PNG ou JPG de ate 10 MB.");
              event.target.value = "";
              return;
            }
            setError("");
            setFile(next);
            setPreview(URL.createObjectURL(next));
          }}
        />
      </label>
      {error ? <Notice error>{error}</Notice> : null}
      <Notice>
        Imagem local, sem envio a terceiros. Leitura automatica de bilhetes nao esta conectada.
      </Notice>
      {preview ? (
        <img
          src={preview}
          alt="Bilhete selecionado para conferencia"
          className="max-h-[600px] max-w-full object-contain"
          onError={() => {
            setError("Nao foi possivel abrir esta imagem.");
            setPreview("");
          }}
        />
      ) : null}
      <Link className={linkClass} to="/analise-manual">
        Conferir odd e probabilidade na analise manual
      </Link>
    </Frame>
  );
}

function PreferenceForm({ banking = false }: { banking?: boolean }) {
  const preferences = usePreferences();
  const [bankroll, setBankroll] = useState(String(preferences.bankroll));
  const [budget, setBudget] = useState(String(preferences.dailyBudget));
  const [stake, setStake] = useState(String(preferences.paperStake));
  const [message, setMessage] = useState("");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const numbers = [Number(bankroll), Number(budget), Number(stake)];
    if (
      numbers.some((number) => !Number.isFinite(number) || number < 0 || number > 1_000_000) ||
      Number(bankroll) < 1 ||
      Number(stake) < 0.01 ||
      Number(stake) > Number(bankroll) ||
      Number(budget) > Number(bankroll)
    ) {
      setMessage(
        "Valores invalidos. Banca minima R$ 1; valor virtual positivo; limite diario e valor por teste nao podem ultrapassar a banca."
      );
      return;
    }
    try {
      savePreferences({
        bankroll: Number(bankroll),
        dailyBudget: Number(budget),
        paperStake: Number(stake)
      });
      setMessage("Preferencias salvas neste navegador.");
    } catch {
      setMessage("Nao foi possivel salvar. Verifique o armazenamento do navegador.");
    }
  };
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <Numeric
          label="Banca inicial virtual (R$)"
          min={1}
          value={bankroll}
          onChange={setBankroll}
        />
        <Numeric label="Limite diario virtual (R$)" min={0} value={budget} onChange={setBudget} />
        <Numeric label="Valor por simulacao (R$)" min={0.01} value={stake} onChange={setStake} />
      </div>
      <Button type="submit" icon={<Save size={16} />}>
        Salvar {banking ? "banca" : "preferencias"}
      </Button>
      {message ? <Notice>{message}</Notice> : null}
    </form>
  );
}

export function BankrollPage() {
  const preferences = usePreferences();
  const bets = loadPaperBets();
  const pnl = bets.reduce((sum, bet) => sum + calculatePaperBetPnl(bet), 0);
  const open = bets
    .filter((bet) => bet.status === "open")
    .reduce((sum, bet) => sum + bet.stakeCents, 0);
  const used = bets
    .filter((bet) => saoPauloDate(bet.createdAt) === saoPauloDate() && bet.status !== "void")
    .reduce((sum, bet) => sum + bet.stakeCents, 0);
  return (
    <Frame title="Banca virtual">
      <PreferenceForm banking />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="Saldo virtual"
          value={formatCurrencyFromCents(preferences.bankroll * 100 + pnl)}
        />
        <Stat label="Reservado em aberto" value={formatCurrencyFromCents(open)} />
        <Stat
          label="Disponivel"
          value={formatCurrencyFromCents(preferences.bankroll * 100 + pnl - open)}
        />
        <Stat label="Usado hoje" value={formatCurrencyFromCents(used)} />
      </div>
      <progress
        aria-label="Uso do limite diario virtual"
        className="h-3 w-full accent-emerald-400"
        max={preferences.dailyBudget * 100 || 1}
        value={Math.min(used, preferences.dailyBudget * 100 || 1)}
      />
      <Notice>
        Saldo exclusivamente simulado. MY FLUX nao consulta o saldo de Betano ou Superbet e nao
        executa apostas.
      </Notice>
    </Frame>
  );
}

const statusLabels: Record<PaperBetStatus, string> = {
  open: "Em aberto",
  won: "Ganha",
  lost: "Perdida",
  void: "Anulada"
};
function BetHistory({ editable = false }: { editable?: boolean }) {
  const [bets, setBets] = useState(loadPaperBets);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const settle = (id: string, status: PaperBetStatus) => {
    const next = loadPaperBets().map((bet) => {
      if (bet.id !== id) return bet;
      const rest = { ...bet };
      delete rest.settledAt;
      return status === "open"
        ? { ...rest, status }
        : { ...rest, status, settledAt: new Date().toISOString() };
    });
    try {
      savePaperBets(next);
      setBets(next);
      setError("");
    } catch {
      setError("Resultado nao salvo. O armazenamento do navegador esta indisponivel.");
    }
  };
  const visible = bets.filter(
    (bet) => filter === "all" || (filter === "open" ? bet.status === "open" : bet.status !== "open")
  );
  return (
    <div className="space-y-4">
      <label className="grid max-w-xs gap-2 text-sm">
        Bilhetes
        <select
          className={inputClass}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Todos</option>
          <option value="open">Em aberto</option>
          <option value="settled">Liquidados</option>
        </select>
      </label>
      {error ? <Notice error>{error}</Notice> : null}
      {!visible.length ? (
        <Notice>
          Nenhum bilhete neste filtro.{" "}
          <Link className={linkClass} to="/combinadas">
            Consultar multiplas
          </Link>
        </Notice>
      ) : null}
      {visible.map((bet) => (
        <article
          className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-4"
          key={bet.id}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label={bet.label} value={localStart(bet.createdAt)} />
            <Stat label="Odd registrada" value={formatOdd(bet.odd)} />
            <Stat label="Valor virtual" value={formatCurrencyFromCents(bet.stakeCents)} />
            <Stat
              label="Lucro/prejuizo simulado"
              value={formatCurrencyFromCents(calculatePaperBetPnl(bet))}
            />
          </div>
          <ol className="divide-y divide-slate-800">
            {bet.legs.map((leg, index) => (
              <li key={index} className="py-2 text-sm">
                <p className="break-words">
                  {leg.event} · {localStart(leg.start)}
                </p>
                <p className="mt-1 text-slate-400">
                  {selectionLabel(leg.selection)} @ {formatOdd(leg.odd)} · {leg.bookmaker}
                </p>
              </li>
            ))}
          </ol>
          {editable ? (
            <label className="grid max-w-xs gap-2 text-sm">
              Resultado manual da simulacao
              <select
                className={inputClass}
                value={bet.status}
                onChange={(event) => settle(bet.id, event.target.value as PaperBetStatus)}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Stat label="Resultado manual" value={statusLabels[bet.status]} />
          )}
        </article>
      ))}
    </div>
  );
}
export function PaperBettingPage() {
  return (
    <Frame title="Paper betting">
      <Notice>
        Simulacao sem dinheiro real. Resultados sao preenchidos manualmente e podem ser corrigidos;
        nao sao verificacao automatica do placar.
      </Notice>
      <BetHistory editable />
    </Frame>
  );
}
export function HistoryPage() {
  return (
    <Frame title="Historico de simulacoes">
      <BetHistory />
    </Frame>
  );
}
export function AnalyticsPage() {
  const bets = loadPaperBets().filter((bet) => bet.status === "won" || bet.status === "lost");
  const pnl = bets.reduce((sum, bet) => sum + calculatePaperBetPnl(bet), 0);
  const stake = bets.reduce((sum, bet) => sum + bet.stakeCents, 0);
  const wins = bets.filter((bet) => bet.status === "won").length;
  let balance = 0,
    peak = 0,
    drawdown = 0;
  for (const bet of [...bets].sort((a, b) =>
    (a.settledAt ?? a.createdAt).localeCompare(b.settledAt ?? b.createdAt)
  )) {
    balance += calculatePaperBetPnl(bet);
    peak = Math.max(peak, balance);
    drawdown = Math.max(drawdown, peak - balance);
  }
  return (
    <Frame title="Resultados simulados">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Lucro/prejuizo" value={formatCurrencyFromCents(pnl)} />
        <Stat label="ROI" value={stake ? formatPercent(pnl / stake) : "Sem amostra"} />
        <Stat
          label="Taxa de acerto"
          value={bets.length ? formatPercent(wins / bets.length) : "Sem amostra"}
        />
        <Stat label="Queda maxima acumulada" value={formatCurrencyFromCents(drawdown)} />
      </div>
      <Notice>
        {bets.length} simulacoes com resultado manual. Anuladas e abertas nao entram no ROI nem na
        taxa de acerto. Esses resultados nao validam um modelo probabilistico.
      </Notice>
      <BetHistory />
    </Frame>
  );
}

type ChatMessage = { role: "user" | "assistant"; text: string; suggestion?: AccumulatorSuggestion };
export function ChatPage() {
  const market = useMarketData();
  const client = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setMessages((items) => [...items, { role: "user", text }]);
    try {
      const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (/saldo|login|apostar automaticamente/.test(normalized)) {
        setMessages((items) => [
          ...items,
          {
            role: "assistant",
            text: "Nao acesso contas nem realizo apostas. O saldo da tela Banca e virtual."
          }
        ]);
        return;
      }
      const now = new Date();
      const date = normalized.includes("amanha")
        ? saoPauloDate(new Date(now.getTime() + 86400_000))
        : normalized.includes("hoje")
          ? saoPauloDate(now)
          : market.scope.date;
      const upcoming = /proximos|semana/.test(normalized) && !normalized.includes("hoje");
      const hourMatch = normalized.match(/(?:apos|depois d[ae]s?|a partir d[ae]s?)\s*(\d{1,2})/);
      const afterHour = hourMatch ? Number(hourMatch[1]) : market.scope.afterHour;
      if (afterHour < 0 || afterHour > 23)
        throw new Error("Informe um horario entre 0 e 23 horas.");
      const oddMatch = normalized.match(/odd\s*(\d+(?:[.,]\d+)?)/);
      const multiple = Boolean(oddMatch) || /multipla|combinada/.test(normalized);
      const target = oddMatch ? Number(oddMatch[1]!.replace(",", ".")) : 7;
      if (multiple && (target < 2 || target > 100))
        throw new Error("A odd alvo deve estar entre 2 e 100.");
      const response = await client.fetchQuery({
        queryKey: [
          "betflux-odds",
          market.preferences.region,
          market.preferences.sport,
          date,
          upcoming
        ],
        queryFn: () =>
          fetchUpcomingOdds(market.preferences.region, market.preferences.sport, date, upcoming),
        staleTime: 120_000
      });
      const scope = { date, upcoming, afterHour };
      const events = market.bookmaker
        ? response.data.map((entry) => ({
            ...entry,
            bookmakers: entry.bookmakers.filter((book) => book.key === market.bookmaker)
          }))
        : response.data;
      let suggestion: AccumulatorSuggestion | null = null;
      if (multiple) suggestion = buildAccumulatorSuggestion(events, target, new Date(), scope);
      else {
        const candidate = buildTopMarketCandidates(events, 1, new Date(), scope)[0];
        if (candidate)
          suggestion = {
            combinedOdd: candidate.outcome.price,
            combinedProbability: candidate.consensusProbability,
            legs: [
              {
                event: candidate.event,
                outcome: candidate.outcome,
                probability: candidate.consensusProbability
              }
            ]
          };
      }
      const period =
        date +
        (upcoming ? " e os 6 dias seguintes" : "") +
        ", a partir de " +
        afterHour +
        "h (Sao Paulo)";
      if (!suggestion) {
        setMessages((items) => [
          ...items,
          {
            role: "assistant",
            text:
              "Nao encontrei " +
              (multiple ? "uma multipla proxima da odd " + formatOdd(target) : "uma selecao") +
              " com cotacoes recentes em " +
              period +
              ". Nao vou completar com jogos de outras datas. " +
              (response.meta.partial ? "A consulta foi parcial." : "")
          }
        ]);
        return;
      }
      const details = suggestion.legs
        .map(
          (leg) =>
            leg.event.homeTeam +
            " x " +
            leg.event.awayTeam +
            " · " +
            localStart(leg.event.commenceTime) +
            "\n" +
            selectionLabel(leg.outcome.name) +
            " @ " +
            formatOdd(leg.outcome.price) +
            " · " +
            leg.outcome.bookmaker
        )
        .join("\n\n");
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text:
            "Sugestao informativa para " +
            period +
            ":\n\n" +
            details +
            "\n\nOdd: " +
            formatOdd(suggestion.combinedOdd) +
            ". Estimativa de mercado: " +
            formatPercent(suggestion.combinedProbability) +
            (multiple ? ", supondo independencia entre os jogos." : ".") +
            " Nao e aposta segura nem EV comprovado. Teste na banca virtual antes de tomar uma decisao." +
            (response.meta.partial ? " Consulta parcial." : ""),
          suggestion
        }
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text:
            error instanceof Error && /Informe|odd alvo/.test(error.message)
              ? error.message
              : oddsError(error)
        }
      ]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame title="Assistente de mercado">
      <MarketControls market={market} />
      <div className="space-y-4" aria-live="polite">
        {!messages.length ? (
          <Notice>
            Nenhuma consulta nesta conversa. Fonte de sugestoes: cotacoes do mercado, sem modelo de
            IA conectado.
          </Notice>
        ) : null}
        {messages.map((message, index) => (
          <article
            key={index}
            className={
              "rounded border p-4 " +
              (message.role === "user"
                ? "border-slate-700 bg-slate-900"
                : "border-emerald-900 bg-slate-950")
            }
          >
            <p className="mb-2 text-xs text-slate-400">
              {message.role === "user" ? "Voce" : "MY FLUX"}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
            {message.suggestion ? (
              <div className="mt-4">
                <SimulateButton suggestion={message.suggestion} />
              </div>
            ) : null}
          </article>
        ))}
        {busy ? <Notice>Consultando os jogos do periodo solicitado...</Notice> : null}
      </div>
      <form onSubmit={(event) => void send(event)} className="flex gap-2">
        <input
          className={inputClass}
              aria-label="Mensagem para MY FLUX"
          placeholder="Multipla odd 7 hoje depois das 18"
          value={draft}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="submit"
          aria-label="Enviar mensagem"
          title="Enviar mensagem"
          disabled={busy || !draft.trim()}
          icon={<Send size={17} />}
        />
      </form>
    </Frame>
  );
}

export function AlertsPage() {
  const market = useMarketData();
  const [error, setError] = useState("");
  return (
    <Frame title="Monitor de cotacoes">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="accent-emerald-400"
          checked={market.preferences.autoRefresh}
          onChange={(event) => {
            try {
              savePreferences({ autoRefresh: event.target.checked });
              setError("");
            } catch {
              setError("Nao foi possivel salvar.");
            }
          }}
        />
        Atualizar a cada 5 minutos enquanto o painel estiver aberto
      </label>
      <Notice>
        Sem notificacoes em segundo plano e sem alertas de valor esperado. Cada atualizacao consulta
        o provedor e pode consumir creditos.
      </Notice>
      {error ? <Notice error>{error}</Notice> : null}
      <MarketControls market={market} />
      <CandidateList candidates={market.candidates.slice(0, 5)} market={market} />
    </Frame>
  );
}
export function ModelsPage() {
  return (
    <Frame title="Metodologia">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Fonte" value="Odds 1X2 de casas de apostas" />
        <Stat label="Modelo estatistico proprio" value="Nao conectado" />
        <Stat label="EV de sugestoes" value="Nao calculado" />
      </div>
      <Section title="Calculo publicado">
        <p className="text-sm leading-7 text-slate-300">
          Para cada casa, a probabilidade implicita de uma selecao e 1 / odd. As tres probabilidades
          sao divididas pela soma para retirar a margem proporcional. A media entre casas forma a
          estimativa de mercado. O ranking usa essa estimativa; a odd exibida e o melhor preco para
          a mesma selecao entre as casas consultadas.
        </p>
      </Section>
      <Section title="Limites">
        <p className="text-sm leading-7 text-slate-300">
          Amostras com mercado incompleto, cotacao de mais de 15 minutos ou partida iniciada nao
          geram sugestoes. Multiplas usam de 2 a 6 eventos de uma mesma casa, sem repetir equipes. A
          estimativa conjunta supoe independencia e nao foi calibrada. Estatisticas ausentes nao sao
          substituidas por numeros inventados.
        </p>
      </Section>
    </Frame>
  );
}
export function SettingsPage() {
  const market = useMarketData();
  return (
    <Frame title="Configuracoes">
      <MarketControls market={market} />
      <Section title="Parametros da simulacao">
        <PreferenceForm />
      </Section>
      <Notice>
        As preferencias e o historico ficam neste navegador. Login, saldo real e execucao em casas
        de apostas nao estao conectados.
      </Notice>
    </Frame>
  );
}
export function AdminPage() {
  const query = useQuery({
    queryKey: ["betflux-status"],
    queryFn: () =>
      apiGet<{
        data: {
          oddsConfigured: boolean;
          cacheEntries: number;
          pendingRequests: number;
          serverTime: string;
        };
      }>("/betting/status"),
    retry: false
  });
  return (
    <Frame title="Status tecnico">
      <Button
        variant="secondary"
        disabled={query.isFetching}
        icon={<RefreshCw size={16} />}
        onClick={() => void query.refetch()}
      >
        Verificar servidor
      </Button>
      {query.isPending ? (
        <Notice>Consultando servidor...</Notice>
      ) : query.isError ? (
        <Notice error>Backend indisponivel. Nenhum status operacional foi confirmado.</Notice>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Backend" value="Respondeu" />
          <Stat
            label="Chave no servidor"
            value={
              query.data.data.oddsConfigured
                ? "Configurada, validade depende do provedor"
                : "Ausente"
            }
          />
          <Stat label="Entradas em cache" value={query.data.data.cacheEntries} />
          <Stat label="Horario do servidor" value={localStart(query.data.data.serverTime)} />
        </div>
      )}
      <Notice>
        Cache de odds: 2 minutos. Catalogo: 1 hora. Falhas de consulta nao viram recomendacoes.
        Credenciais ficam exclusivamente no servidor.
      </Notice>
    </Frame>
  );
}

function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max = 1_000_000
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid gap-2 text-sm">
      {label}
      <input
        className={inputClass}
        type="number"
        step="0.01"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
