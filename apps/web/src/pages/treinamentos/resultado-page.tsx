// Treinamentos Interativos — o desfecho de uma tentativa concluída, no mesmo Palco: (1) o que
// aconteceu, com a cena reagindo aos acontecimentos; (2) os resultados; (3) o que fazer agora. Abaixo
// do quadro, o resumo das decisões (a análise interativa de causa e consequência entra na Fase 7).
// Recarregar mostra o mesmo desfecho: ele vem gravado do servidor (GET /resultado).
import { useQuery } from "@tanstack/react-query";
import type { TreinoNivel } from "@my-flux/shared";
import { CircleAlert, CircleCheck, OctagonAlert, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiDosTreinamentos, type ResultadoDaTentativa } from "../../features/treinamentos/api";
import { cenaDoDesfecho } from "../../features/treinamentos/desfecho";
import { pacoteDeCena } from "../../features/treinamentos/palco/pacotes";
import { Palco } from "../../features/treinamentos/palco/palco";
import { useTelaCheia } from "../../features/treinamentos/palco/use-tela-cheia";

const NIVEL: Record<TreinoNivel, { rotulo: string; Icone: typeof CircleCheck; cor: string }> = {
  ok: { rotulo: "Bom", Icone: CircleCheck, cor: "--palco-brilho" },
  warn: { rotulo: "Atenção", Icone: CircleAlert, cor: "--palco-atencao" },
  bad: { rotulo: "Risco", Icone: OctagonAlert, cor: "--palco-risco" }
};

export function ResultadoPage() {
  const { tentativaId = "" } = useParams();
  const consulta = useQuery({
    queryKey: ["treinamentos", "resultado", tentativaId],
    queryFn: () => apiDosTreinamentos.resultado(tentativaId),
    retry: false
  });
  if (consulta.isPending)
    return (
      <p className="py-20 text-center text-slate-300" role="status">
        Carregando o desfecho...
      </p>
    );
  if (consulta.isError)
    return (
      <div role="alert" className="mx-auto max-w-xl py-20 text-center">
        <TriangleAlert className="mx-auto text-[#FBBF24]" aria-hidden="true" />
        <h1 className="mt-3 font-display text-2xl font-bold">
          Não foi possível abrir este resultado
        </h1>
        <p className="mt-2 text-slate-300">{consulta.error.message}</p>
      </div>
    );
  return <Desfecho resultado={consulta.data} />;
}

function Desfecho({ resultado }: { resultado: ResultadoDaTentativa }) {
  const pacote = pacoteDeCena(resultado.cenario.scenePack);
  const estado = useMemo(
    () => cenaDoDesfecho(resultado, pacote.estadoInicial),
    [resultado, pacote]
  );
  const ocorridos = resultado.desfecho.events.filter((e) => e.aconteceu);
  const houveArco = estado.state === "arc";
  const [cena, setCena] = useState(0);
  const modulo = useRef<HTMLDivElement>(null);
  const telaCheia = useTelaCheia(modulo);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), [cena]);

  const botao =
    "min-h-11 rounded-mf-controle bg-[rgb(var(--palco-brilho))] px-5 text-sm font-semibold text-[#020617]";

  return (
    <div
      ref={modulo}
      className={telaCheia.planoB ? "palco-tela-cheia overflow-y-auto bg-[#020617]" : ""}
    >
      <h1 className="sr-only">Desfecho: {resultado.cenario.titulo}</h1>
      <Palco
        pacote={resultado.cenario.scenePack}
        estado={estado}
        plano={cena === 0 ? (houveArco ? "cab" : "wide") : "wide"}
        tremor={houveArco && cena === 0 ? 1 : 0}
        clarao={houveArco && cena === 0 ? 1 : 0}
        hud={{ titulo: `${resultado.cenario.titulo} · desfecho` }}
        telaCheia={telaCheia}
      >
        <section
          aria-labelledby="desfecho-titulo"
          aria-live="polite"
          className="palco-vidro min-h-0 overflow-y-auto rounded-mf-cartao p-4 sm:p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--palco-brilho-2))]">
            Desfecho · {cena + 1} de 3{resultado.participante ? ` · ${resultado.participante}` : ""}
          </p>
          {cena === 0 ? (
            <>
              <h2
                id="desfecho-titulo"
                ref={titulo}
                tabIndex={-1}
                className="mt-1 font-display text-xl font-bold outline-none"
              >
                O que aconteceu
              </h2>
              <ul className="mt-2 space-y-1.5">
                {ocorridos.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-sm">
                    {e.tone === "good" ? (
                      <CircleCheck
                        size={16}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[rgb(var(--palco-brilho))]"
                      />
                    ) : (
                      <OctagonAlert
                        size={16}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[rgb(var(--palco-risco))]"
                      />
                    )}
                    <span>
                      <span className="sr-only">{e.tone === "good" ? "Bom: " : "Ruim: "}</span>
                      {e.label}
                    </span>
                  </li>
                ))}
                {ocorridos.length === 0 ? (
                  <li className="text-sm text-slate-300">Nenhum acontecimento marcante.</li>
                ) : null}
              </ul>
              <div className="mt-3 flex justify-end">
                <button type="button" className={botao} onClick={() => setCena(1)}>
                  Ver os resultados
                </button>
              </div>
            </>
          ) : null}
          {cena === 1 ? (
            <>
              <h2
                id="desfecho-titulo"
                ref={titulo}
                tabIndex={-1}
                className="mt-1 font-display text-xl font-bold outline-none"
              >
                Resultados
              </h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                {resultado.desfecho.outcomes.map((o) => {
                  const { rotulo, Icone, cor } = NIVEL[o.nivel];
                  return (
                    <li
                      key={o.id}
                      className="rounded-mf-controle border border-white/10 bg-white/5 p-3"
                    >
                      <p className="text-xs text-slate-300">{o.label}</p>
                      <p
                        className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: `rgb(var(${cor}))` }}
                      >
                        <Icone size={15} aria-hidden="true" />
                        {rotulo}
                      </p>
                      <p className="mt-0.5 text-sm text-white">{o.texto}</p>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex justify-end">
                <button type="button" className={botao} onClick={() => setCena(2)}>
                  Continuar
                </button>
              </div>
            </>
          ) : null}
          {cena === 2 ? (
            <>
              <h2
                id="desfecho-titulo"
                ref={titulo}
                tabIndex={-1}
                className="mt-1 font-display text-xl font-bold outline-none"
              >
                E agora?
              </h2>
              <p className="mt-1 text-sm text-slate-200">
                Abaixo, cada decisão com o procedimento esperado. Você pode refazer as 5 perguntas
                quando quiser.
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCena(0)}
                  className="min-h-11 rounded-mf-controle border border-white/25 px-4 text-sm text-white hover:bg-white/10"
                >
                  Rever o desfecho
                </button>
                {resultado.acesso === "dono" ? (
                  <Link
                    to={`/treinamentos/${resultado.atribuicaoId}/jogar`}
                    className={`${botao} inline-flex items-center gap-2`}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Refazer as 5 perguntas
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </Palco>

      <section
        aria-labelledby="decisoes-titulo"
        className="mt-6 rounded-mf-cartao border border-white/10 bg-white/5 p-4 sm:p-6"
      >
        <h2 id="decisoes-titulo" className="font-display text-xl font-bold">
          Suas decisões
        </h2>
        {resultado.cenario.exemplo ? (
          <p className="mt-1 text-xs text-[rgb(var(--palco-atencao))]">
            EXEMPLO: procedimentos ainda em validação técnica. Não use como norma.
          </p>
        ) : null}
        <ol className="mt-3 space-y-3">
          {resultado.decisoes.map((d) => {
            const resposta = resultado.respostas.find((r) => r.decisao === d.id);
            return (
              <li key={d.id} className="rounded-mf-controle border border-white/10 p-3">
                <p className="flex items-center gap-2 font-semibold">
                  {d.cumpriu ? (
                    <CircleCheck
                      size={16}
                      aria-hidden="true"
                      className="text-[rgb(var(--palco-brilho))]"
                    />
                  ) : (
                    <OctagonAlert
                      size={16}
                      aria-hidden="true"
                      className="text-[rgb(var(--palco-risco))]"
                    />
                  )}
                  {d.label}
                  <span className="text-xs font-normal text-slate-300">
                    {d.cumpriu ? "· cumprida" : "· não cumprida"}
                  </span>
                </p>
                {resposta ? (
                  <p className="mt-1 text-sm text-slate-300">Sua escolha: {resposta.texto}</p>
                ) : null}
                <p className="mt-1 text-sm text-slate-100">Procedimento: {d.procedure}</p>
              </li>
            );
          })}
        </ol>
        {resultado.validacao.validada ? (
          <p className="mt-4 rounded-mf-controle bg-[rgb(var(--palco-brilho)/0.12)] p-3 text-sm">
            Validado pelo RH{resultado.validacao.nota ? `: “${resultado.validacao.nota}”` : "."}
          </p>
        ) : null}
      </section>
    </div>
  );
}
