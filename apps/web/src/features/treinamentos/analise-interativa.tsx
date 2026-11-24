// Análise interativa de causa e consequência: Decisões → Acontecimentos → Resultados.
//  - Clicar numa decisão liga/desliga ("e se eu tivesse feito diferente?"); o desfecho novo vem do
//    MESMO motor, no servidor (POST /simular), sem gravar nada. Só o dono da tentativa explora.
//  - Clicar num acontecimento ou resultado mostra a cadeia de causas, até as decisões.
//  - "Ver o caminho completo", "Voltar à minha escolha" e "Refazer as 5 perguntas".
//  - A mesma análise em lista (leitor de tela, celular). O grafo é desenho próprio: nós em HTML
//    (botões de verdade, com teclado) e arestas num SVG por cima, medidas no layout e redesenhadas
//    no `resize` (inclusive ao entrar e sair da tela cheia).
import type { TreinoDesfecho, TreinoNivel } from "@my-flux/shared";
import {
  Circle,
  CircleAlert,
  CircleCheck,
  List,
  Network,
  OctagonAlert,
  RotateCcw,
  Route,
  Undo2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import {
  arestasAtivas,
  cadeiaDeCausas,
  estadoDosNos,
  explicacaoDe,
  montarGrafo,
  resultadosQueMudaram,
  type NoDoGrafo,
  type TipoDoNo
} from "./analise";
import { apiDosTreinamentos, type ResultadoDaTentativa } from "./api";

const NIVEL: Record<TreinoNivel, { rotulo: string; Icone: typeof CircleCheck; cor: string }> = {
  ok: { rotulo: "Bom", Icone: CircleCheck, cor: "--palco-brilho" },
  warn: { rotulo: "Atenção", Icone: CircleAlert, cor: "--palco-atencao" },
  bad: { rotulo: "Risco", Icone: OctagonAlert, cor: "--palco-risco" }
};
const COLUNAS: { tipo: TipoDoNo; titulo: string }[] = [
  { tipo: "decisao", titulo: "Suas decisões" },
  { tipo: "acontecimento", titulo: "Acontecimentos" },
  { tipo: "resultado", titulo: "Resultados" }
];

type Linha = { chave: string; d: string; cor: string; ativa: boolean };

function mesmasDecisoes(a: Record<string, boolean>, b: Record<string, boolean>) {
  return Object.keys(a).every((k) => a[k] === b[k]);
}

export function AnaliseInterativa({ resultado }: { resultado: ResultadoDaTentativa }) {
  const original = useMemo(
    () => Object.fromEntries(resultado.decisoes.map((d) => [d.id, d.cumpriu])),
    [resultado.decisoes]
  );
  const grafo = useMemo(() => montarGrafo(resultado), [resultado]);
  const rotulos = useMemo(
    () => Object.fromEntries(grafo.nos.map((n) => [n.id, n.rotulo])),
    [grafo]
  );
  const podeSimular = resultado.acesso === "dono";

  const [decisoes, setDecisoes] = useState(original);
  const [desfecho, setDesfecho] = useState<TreinoDesfecho>(resultado.desfecho);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [caminhoCompleto, setCaminhoCompleto] = useState(false);
  const [vista, setVista] = useState<"grafo" | "lista">(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches
      ? "lista"
      : "grafo"
  );
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState("");
  const pedido = useRef(0);

  const estado = estadoDosNos(decisoes, desfecho);
  const ativas = useMemo(() => arestasAtivas(desfecho), [desfecho]);
  const mudaram = useMemo(
    () => resultadosQueMudaram(resultado.desfecho, desfecho),
    [resultado.desfecho, desfecho]
  );
  const alterado = !mesmasDecisoes(decisoes, original);
  const destaque = useMemo(() => {
    if (selecionado) return cadeiaDeCausas(desfecho, selecionado);
    if (caminhoCompleto) {
      const nos = new Set<string>();
      for (const chave of ativas) chave.split("->").forEach((n) => nos.add(n));
      return { nos, arestas: ativas };
    }
    return null;
  }, [selecionado, caminhoCompleto, desfecho, ativas]);

  async function alternar(id: string) {
    if (!podeSimular) return;
    const novas = { ...decisoes, [id]: !decisoes[id] };
    setDecisoes(novas);
    setErro("");
    // Voltou à escolha original: o retrato gravado é a resposta, sem perguntar ao servidor.
    if (mesmasDecisoes(novas, original)) {
      pedido.current += 1;
      setDesfecho(resultado.desfecho);
      return;
    }
    const meu = ++pedido.current;
    setCalculando(true);
    try {
      const simulado = await apiDosTreinamentos.simular(resultado.tentativaId, novas);
      if (meu === pedido.current) setDesfecho(simulado);
    } catch (e) {
      if (meu === pedido.current)
        setErro(e instanceof Error ? e.message : "Não foi possível recalcular.");
    } finally {
      if (meu === pedido.current) setCalculando(false);
    }
  }

  function voltar() {
    pedido.current += 1;
    setDecisoes(original);
    setDesfecho(resultado.desfecho);
    setCalculando(false);
    setErro("");
  }

  const resumo = desfecho.outcomes
    .map((o) => `${o.label}: ${NIVEL[o.nivel].rotulo}, ${o.texto}`)
    .join(". ");

  return (
    <section
      aria-labelledby="analise-titulo"
      className="palco mt-6 rounded-mf-cartao border border-white/10 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="analise-titulo"
            tabIndex={-1}
            className="font-display text-xl font-bold outline-none"
          >
            Causa e consequência
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            {podeSimular
              ? "Clique numa decisão para ver o que teria acontecido se você tivesse feito diferente. Clique num acontecimento ou resultado para ver por que ele aconteceu."
              : "Clique num acontecimento ou resultado para ver por que ele aconteceu."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Acao
            aoClicar={() => setVista(vista === "grafo" ? "lista" : "grafo")}
            icone={vista === "grafo" ? <List size={16} /> : <Network size={16} />}
          >
            {vista === "grafo" ? "Ver como lista" : "Ver como grafo"}
          </Acao>
          <Acao
            aoClicar={() => {
              setSelecionado(null);
              setCaminhoCompleto(!caminhoCompleto);
            }}
            pressionado={caminhoCompleto}
            icone={<Route size={16} />}
          >
            Ver o caminho completo
          </Acao>
          {podeSimular ? (
            <Acao aoClicar={voltar} desabilitado={!alterado} icone={<Undo2 size={16} />}>
              Voltar à minha escolha
            </Acao>
          ) : null}
          {podeSimular ? (
            <Link
              to={`/treinamentos/${resultado.atribuicaoId}/jogar`}
              className="inline-flex min-h-11 items-center gap-2 rounded-mf-controle bg-[rgb(var(--palco-brilho))] px-4 text-sm font-semibold text-[#020617]"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Refazer as 5 perguntas
            </Link>
          ) : null}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {alterado ? `Simulação: ${resumo}` : ""}
      </p>
      {alterado ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-mf-controle bg-[rgb(var(--palco-atencao)/0.12)] px-3 py-1.5 text-xs text-[rgb(var(--palco-atencao))]">
          <CircleAlert size={14} aria-hidden="true" />
          {calculando ? "Recalculando..." : "Você está vendo um “e se?”: nada disso foi gravado."}
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="mt-2 text-sm text-[rgb(var(--palco-risco))]">
          {erro}
        </p>
      ) : null}

      {vista === "grafo" ? (
        <GrafoDeCausas
          nos={grafo.nos}
          arestas={grafo.arestas}
          estado={estado}
          ativas={ativas}
          destaque={destaque}
          mudaram={mudaram}
          selecionado={selecionado}
          podeSimular={podeSimular}
          aoAlternar={(id) => void alternar(id)}
          aoSelecionar={(id) => {
            setCaminhoCompleto(false);
            setSelecionado(selecionado === id ? null : id);
          }}
        />
      ) : (
        <ListaDeCausas
          nos={grafo.nos}
          estado={estado}
          desfecho={desfecho}
          rotulos={rotulos}
          mudaram={mudaram}
          podeSimular={podeSimular}
          aoAlternar={(id) => void alternar(id)}
        />
      )}

      {vista === "grafo" && selecionado ? (
        <div
          aria-live="polite"
          className="mt-4 rounded-mf-controle border border-white/10 bg-white/5 p-3 text-sm"
        >
          <p className="font-semibold text-white">Por que “{rotulos[selecionado]}”?</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-200">
            {explicacaoDe(desfecho, selecionado, rotulos).map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Acao({
  children,
  icone,
  aoClicar,
  pressionado,
  desabilitado
}: {
  children: ReactNode;
  icone: ReactNode;
  aoClicar: () => void;
  pressionado?: boolean;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      aria-pressed={pressionado}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-mf-controle border px-3 text-sm font-medium disabled:opacity-40",
        pressionado
          ? "border-[rgb(var(--palco-brilho))] bg-[rgb(var(--palco-brilho)/0.15)] text-white"
          : "border-white/20 text-slate-100 hover:bg-white/10"
      )}
    >
      <span aria-hidden="true">{icone}</span>
      {children}
    </button>
  );
}

/** O selo de estado de um nó: sempre ícone e palavra (nunca só cor). */
function SeloDoNo({
  no,
  estado
}: {
  no: NoDoGrafo;
  estado: ReturnType<typeof estadoDosNos>[string] | undefined;
}) {
  if (!estado) return null;
  if (estado.tipo === "decisao")
    return estado.cumpriu ? (
      <span className="inline-flex items-center gap-1 text-xs text-[rgb(var(--palco-brilho))]">
        <CircleCheck size={13} aria-hidden="true" /> Cumprida
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-[rgb(var(--palco-risco))]">
        <OctagonAlert size={13} aria-hidden="true" /> Não cumprida
      </span>
    );
  if (estado.tipo === "acontecimento")
    return estado.aconteceu ? (
      <span
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: `rgb(var(${estado.tom === "good" ? "--palco-brilho" : "--palco-risco"}))` }}
      >
        {estado.tom === "good" ? (
          <CircleCheck size={13} aria-hidden="true" />
        ) : (
          <OctagonAlert size={13} aria-hidden="true" />
        )}
        Aconteceu
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Circle size={13} aria-hidden="true" /> Não aconteceu
      </span>
    );
  const { rotulo, Icone, cor } = NIVEL[estado.nivel];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: `rgb(var(${cor}))` }}
      title={no.rotulo}
    >
      <Icone size={13} aria-hidden="true" /> {rotulo} ·{" "}
      <span className="text-slate-200">{estado.texto}</span>
    </span>
  );
}

function GrafoDeCausas({
  nos,
  arestas,
  estado,
  ativas,
  destaque,
  mudaram,
  selecionado,
  podeSimular,
  aoAlternar,
  aoSelecionar
}: {
  nos: NoDoGrafo[];
  arestas: { chave: string; de: string; para: string }[];
  estado: ReturnType<typeof estadoDosNos>;
  ativas: Set<string>;
  destaque: { nos: Set<string>; arestas: Set<string> } | null;
  mudaram: Set<string>;
  selecionado: string | null;
  podeSimular: boolean;
  aoAlternar: (id: string) => void;
  aoSelecionar: (no: string) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const elementos = useRef(new Map<string, HTMLElement>());
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [tamanho, setTamanho] = useState({ w: 0, h: 0 });

  const medir = useCallback(() => {
    const raiz = caixa.current;
    if (!raiz) return;
    const base = raiz.getBoundingClientRect();
    const novas: Linha[] = [];
    for (const a of arestas) {
      const de = elementos.current.get(a.de)?.getBoundingClientRect();
      const para = elementos.current.get(a.para)?.getBoundingClientRect();
      if (!de || !para || de.width === 0 || para.width === 0) continue;
      const mesmaColuna = Math.abs(de.left - para.left) < 8;
      let d: string;
      if (mesmaColuna) {
        // Mesma coluna: a curva sai pela direita e volta, sem cruzar os nós.
        const x = de.right - base.left;
        const y1 = de.top + de.height / 2 - base.top;
        const y2 = para.top + para.height / 2 - base.top;
        d = `M ${x} ${y1} C ${x + 48} ${y1}, ${x + 48} ${y2}, ${x} ${y2}`;
      } else {
        const x1 = de.right - base.left;
        const y1 = de.top + de.height / 2 - base.top;
        const x2 = para.left - base.left;
        const y2 = para.top + para.height / 2 - base.top;
        const meio = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${meio} ${y1}, ${meio} ${y2}, ${x2} ${y2}`;
      }
      // A cor diz se o efeito foi favorável: causar algo bom ou evitar algo ruim é verde; causar
      // algo ruim, vermelho; um bom que não foi preciso, neutro; resultado em atenção, âmbar.
      const alvo = estado[a.para];
      const cor =
        alvo?.tipo === "resultado"
          ? alvo.nivel === "ok"
            ? "--palco-brilho"
            : alvo.nivel === "warn"
              ? "--palco-atencao"
              : "--palco-risco"
          : alvo?.tipo !== "acontecimento"
            ? "--palco-neutro"
            : alvo.aconteceu
              ? alvo.tom === "good"
                ? "--palco-brilho"
                : "--palco-risco"
              : alvo.tom === "bad"
                ? "--palco-brilho" // evitou algo ruim
                : "--palco-neutro"; // algo bom que não foi preciso
      novas.push({ chave: a.chave, d, ativa: ativas.has(a.chave), cor });
    }
    setLinhas(novas);
    setTamanho({ w: base.width, h: base.height });
  }, [arestas, ativas, estado]);

  useEffect(() => {
    const quadro = requestAnimationFrame(medir);
    window.addEventListener("resize", medir);
    const observador =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => medir()) : null;
    if (caixa.current) observador?.observe(caixa.current);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", medir);
      observador?.disconnect();
    };
  }, [medir]);

  return (
    <div ref={caixa} className="relative mt-5">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={tamanho.w}
        height={tamanho.h}
      >
        {linhas.map((l) => {
          const realcada = destaque?.arestas.has(l.chave) ?? false;
          const apagada = destaque !== null && !realcada;
          return (
            <path
              key={l.chave}
              d={l.d}
              fill="none"
              stroke={l.ativa ? `rgb(var(${l.cor}))` : "rgb(148 163 184)"}
              strokeOpacity={apagada ? 0.12 : l.ativa ? 0.9 : 0.35}
              strokeWidth={realcada ? 3.5 : l.ativa ? 2 : 1.25}
              strokeDasharray={l.ativa ? undefined : "5 6"}
              data-aresta={l.chave}
              data-ativa={l.ativa}
            />
          );
        })}
      </svg>
      <div className="relative grid gap-x-20 gap-y-6 md:grid-cols-3">
        {COLUNAS.map((coluna) => (
          <div key={coluna.tipo}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
              {coluna.titulo}
            </h3>
            <ul className="space-y-2">
              {nos
                .filter((n) => n.tipo === coluna.tipo)
                .map((no) => {
                  const ehDecisao = no.tipo === "decisao";
                  const estadoDoNo = estado[no.id];
                  const apagado = destaque !== null && !destaque.nos.has(no.id);
                  const naoAconteceu =
                    estadoDoNo?.tipo === "acontecimento" && !estadoDoNo.aconteceu;
                  const classe = cn(
                    "block w-full min-h-11 rounded-mf-controle border px-3 py-2 text-left text-sm transition-opacity",
                    selecionado === no.id
                      ? "border-[rgb(var(--palco-brilho))] bg-white/10"
                      : "border-white/15 bg-white/5",
                    (apagado || naoAconteceu) && "opacity-45",
                    "hover:border-white/40"
                  );
                  const conteudo = (
                    <>
                      <span className="block font-medium text-white">{no.rotulo}</span>
                      <SeloDoNo no={no} estado={estadoDoNo} />
                      {mudaram.has(no.id.split(":")[1]!) && no.tipo === "resultado" ? (
                        <span className="ml-2 rounded-full bg-[rgb(var(--palco-atencao)/0.15)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[rgb(var(--palco-atencao))]">
                          mudou
                        </span>
                      ) : null}
                    </>
                  );
                  return (
                    <li
                      key={no.id}
                      ref={(el) => {
                        if (el) elementos.current.set(no.id, el);
                        else elementos.current.delete(no.id);
                      }}
                    >
                      {ehDecisao ? (
                        <button
                          type="button"
                          className={classe}
                          aria-pressed={
                            estadoDoNo?.tipo === "decisao" ? estadoDoNo.cumpriu : undefined
                          }
                          aria-disabled={!podeSimular}
                          onClick={() => aoAlternar(no.id.split(":")[1]!)}
                          aria-label={`${no.rotulo}: ${estadoDoNo?.tipo === "decisao" && estadoDoNo.cumpriu ? "cumprida" : "não cumprida"}.${podeSimular ? " Trocar para simular." : ""}`}
                        >
                          {conteudo}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={classe}
                          aria-pressed={selecionado === no.id}
                          onClick={() => aoSelecionar(no.id)}
                        >
                          {conteudo}
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A mesma análise em lista: resultados com o porquê, acontecimentos e as decisões (com o "e se?"). */
function ListaDeCausas({
  nos,
  estado,
  desfecho,
  rotulos,
  mudaram,
  podeSimular,
  aoAlternar
}: {
  nos: NoDoGrafo[];
  estado: ReturnType<typeof estadoDosNos>;
  desfecho: TreinoDesfecho;
  rotulos: Record<string, string>;
  mudaram: Set<string>;
  podeSimular: boolean;
  aoAlternar: (id: string) => void;
}) {
  const porTipo = (tipo: TipoDoNo) => nos.filter((n) => n.tipo === tipo);
  return (
    <div className="mt-5 grid gap-5 md:grid-cols-3">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          Resultados
        </h3>
        <ul className="space-y-3">
          {porTipo("resultado").map((no) => (
            <li key={no.id} className="rounded-mf-controle border border-white/10 p-3 text-sm">
              <p className="font-medium text-white">
                {no.rotulo}
                {mudaram.has(no.id.split(":")[1]!) ? (
                  <span className="ml-2 text-xs text-[rgb(var(--palco-atencao))]">(mudou)</span>
                ) : null}
              </p>
              <SeloDoNo no={no} estado={estado[no.id]} />
              <p className="mt-1 text-xs text-slate-300">Porque:</p>
              <ul className="list-disc pl-5 text-slate-200">
                {explicacaoDe(desfecho, no.id, rotulos).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          Acontecimentos
        </h3>
        <ul className="space-y-3">
          {porTipo("acontecimento").map((no) => (
            <li key={no.id} className="rounded-mf-controle border border-white/10 p-3 text-sm">
              <p className="font-medium text-white">{no.rotulo}</p>
              <SeloDoNo no={no} estado={estado[no.id]} />
              <ul className="mt-1 list-disc pl-5 text-slate-200">
                {explicacaoDe(desfecho, no.id, rotulos).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          Suas decisões
        </h3>
        <ul className="space-y-2">
          {porTipo("decisao").map((no) => {
            const e = estado[no.id];
            const cumpriu = e?.tipo === "decisao" && e.cumpriu;
            return (
              <li key={no.id} className="rounded-mf-controle border border-white/10 p-3 text-sm">
                <p className="font-medium text-white">{no.rotulo}</p>
                <SeloDoNo no={no} estado={e} />
                {podeSimular ? (
                  <button
                    type="button"
                    onClick={() => aoAlternar(no.id.split(":")[1]!)}
                    className="mt-2 block min-h-11 rounded-mf-controle border border-white/20 px-3 text-xs text-white hover:bg-white/10"
                  >
                    E se eu {cumpriu ? "não tivesse cumprido" : "tivesse cumprido"}?
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
