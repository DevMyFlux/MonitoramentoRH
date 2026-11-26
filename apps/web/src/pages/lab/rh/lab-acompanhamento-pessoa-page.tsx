// Leadership Lab — uma pessoa no acompanhamento: a linha do tempo dos testes, cada cenário com as
// 5 decisões, os desfechos, as alternativas escolhidas e o tempo, as contestações e a comparação com
// o grupo (só entre participantes). O servidor só abre quem o usuário pode ver (o RH, das turmas dele).
import { labRotuloDaContestacao, type LabAcompanhamentoSessao } from "@my-flux/shared";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  BotaoLink,
  EmptyState,
  Escalonar,
  LoadingState
} from "../../../features/leadership-lab/ui";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import { usePessoaDoAcompanhamento } from "../../../features/leadership-lab/acompanhamento-hooks";
import { Cartao } from "../../../features/leadership-lab/componentes/cartao";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import {
  formatarDataEHora,
  formatarPercentual,
  formatarRelogio
} from "../../../features/leadership-lab/rotulos";
import { nomeDoPublico } from "../../treinamentos/config-regras";

const tomDoDesfecho = { ok: "success", warn: "warning", bad: "danger" } as const;
const rotuloDoDesfecho = { ok: "Adequado", warn: "Atenção", bad: "Crítico" } as const;
const tomDaContestacao = {
  pendente: "neutral",
  em_analise: "warning",
  aceita: "success",
  rejeitada: "neutral"
} as const;

export function LabAcompanhamentoPessoaPage() {
  const { participanteId = "" } = useParams();
  const pessoa = usePessoaDoAcompanhamento(participanteId);
  const voltar = (
    <BotaoLink
      to="/lab/rh/acompanhamento?aba=pessoas"
      variant="secondary"
      icon={<ArrowLeft size={16} />}
    >
      Voltar às pessoas
    </BotaoLink>
  );

  return (
    <LayoutDoAcompanhamento>
      {pessoa.isPending ? (
        <LoadingState />
      ) : pessoa.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(pessoa.error, "acompanhamento")}
          aoTentarDeNovo={() => void pessoa.refetch()}
          acao={voltar}
        />
      ) : (
        <Escalonar className="space-y-8">
          <div>{voltar}</div>
          <Cartao
            titulo={pessoa.data.pessoa.nome}
            descricao={[
              pessoa.data.pessoa.identificador,
              pessoa.data.pessoa.cargo,
              pessoa.data.pessoa.nivel,
              pessoa.data.pessoa.area,
              pessoa.data.pessoa.turmas.length
                ? `Turmas: ${pessoa.data.pessoa.turmas.join(", ")}`
                : null
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            {pessoa.data.comparacao ? (
              <ComparacaoComOGrupo comparacao={pessoa.data.comparacao} />
            ) : (
              <p className="text-lab-pequeno text-lab-tinta-2">
                Sem comparação com o grupo: ela aparece quando a pessoa tem um teste concluído e há
                outras pessoas do mesmo público.
              </p>
            )}
          </Cartao>

          <section aria-label="Linha do tempo" className="space-y-4">
            <h2 className="text-lab-h2 text-lab-tinta">Linha do tempo</h2>
            {pessoa.data.sessoes.length === 0 ? (
              <EmptyState
                title="Ainda não fez o teste"
                description="Quando a pessoa começar, cada cenário aparece aqui, com as decisões e o tempo."
              />
            ) : (
              pessoa.data.sessoes.map((s) => <Sessao key={s.sessaoId} s={s} />)
            )}
          </section>

          <Cartao
            titulo="Contestações"
            acao={
              <Link
                to="/lab/rh/contestacoes"
                className="text-lab-pequeno font-medium text-lab-destaque-texto hover:underline"
              >
                Abrir as contestações
              </Link>
            }
          >
            {pessoa.data.contestacoes.length === 0 ? (
              <p className="text-lab-pequeno text-lab-tinta-2">Nenhuma contestação.</p>
            ) : (
              <ul className="space-y-3">
                {pessoa.data.contestacoes.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lab-md border border-lab-linha p-3 text-lab-pequeno"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tomDaContestacao[c.status]}>
                        {labRotuloDaContestacao[c.status]}
                      </Badge>
                      <span className="font-medium text-lab-tinta">{c.ponto}</span>
                      <span className="text-lab-legenda text-lab-tinta-2">
                        {formatarDataEHora(c.criadoEm)}
                      </span>
                    </div>
                    <p className="mt-2 text-lab-tinta-2">{c.motivo}</p>
                    {c.nota ? (
                      <p className="mt-2 border-l-2 border-lab-linha pl-3 text-lab-tinta-2">
                        Justificativa: {c.nota}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </Escalonar>
      )}
    </LayoutDoAcompanhamento>
  );
}

function ComparacaoComOGrupo({
  comparacao: c
}: {
  comparacao: NonNullable<
    NonNullable<ReturnType<typeof usePessoaDoAcompanhamento>["data"]>["comparacao"]
  >;
}) {
  const linhas = [
    ["Aderência", c.aderenciaDaPessoa, c.aderenciaDoGrupo],
    ["Agilidade", c.agilidadeDaPessoa, c.agilidadeDoGrupo]
  ] as const;
  return (
    <div>
      <p className="text-lab-pequeno text-lab-tinta-2">
        Comparação com o grupo: {c.pessoas} pessoas do público {nomeDoPublico[c.publico]}. Só
        participantes entram; testes internos ficam de fora.
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {linhas.map(([rotulo, da, doGrupo]) => (
          <div key={rotulo} className="rounded-lab-md bg-lab-superficie-2 p-4">
            <dt className="text-lab-pequeno font-medium text-lab-tinta-2">{rotulo}</dt>
            <dd className="mt-1 text-lab-pequeno text-lab-tinta">
              <span className="tabular fonte-display text-xl font-bold">
                {formatarPercentual(da)}
              </span>{" "}
              da pessoa · grupo {formatarPercentual(doGrupo)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Sessao({ s }: { s: LabAcompanhamentoSessao }) {
  const titulo = `${formatarDataEHora(s.iniciadaEm)}${s.publico ? ` · ${nomeDoPublico[s.publico]}` : ""}`;
  return (
    <Cartao
      titulo={titulo}
      descricao={
        s.status === "concluida"
          ? `Concluída em ${s.concluidaEm ? formatarDataEHora(s.concluidaEm) : "—"} · aderência ${formatarPercentual(s.aderenciaGeral)} · agilidade ${formatarPercentual(s.agilidade)}`
          : "Em andamento"
      }
      acao={
        <span className="flex flex-wrap gap-2">
          {s.origem === "interno" ? <Badge tone="info">Teste interno</Badge> : null}
          {s.experimental ? <Badge tone="warning">Experimental</Badge> : null}
          {s.contestadoDeferido ? <Badge tone="info">Anulado: contestação deferida</Badge> : null}
        </span>
      }
    >
      <ol className="space-y-3">
        {s.cenarios.map((c) => (
          <li key={c.ordem}>
            <details className="rounded-lab-md border border-lab-linha p-3">
              <summary className="cursor-pointer text-lab-pequeno font-medium text-lab-tinta">
                {c.ordem}. {c.titulo}{" "}
                <span className="font-normal text-lab-tinta-2">
                  (versão {c.versao}
                  {c.exemplo ? ", texto de exemplo" : ""})
                  {c.status === "concluida"
                    ? ` · ${c.decisoes.filter((d) => d.cumpriu).length}/${c.decisoes.length} decisões`
                    : c.status === "em_andamento"
                      ? " · em andamento"
                      : " · ainda não aberto"}
                  {c.tempoTotalMs !== null ? ` · ${formatarRelogio(c.tempoTotalMs)}` : ""}
                </span>
              </summary>
              {c.decisoes.length > 0 ? (
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="text-lab-pequeno font-semibold text-lab-tinta">Decisões</h4>
                    <ul className="mt-2 space-y-1 text-lab-pequeno">
                      {c.decisoes.map((d) => (
                        <li key={d.id} className="flex items-start gap-2">
                          <Badge tone={d.cumpriu ? "success" : "danger"}>
                            {d.cumpriu ? "Cumpriu" : "Não cumpriu"}
                          </Badge>
                          <span className="text-lab-tinta">{d.label}</span>
                        </li>
                      ))}
                    </ul>
                    <h4 className="mt-4 text-lab-pequeno font-semibold text-lab-tinta">
                      Desfechos
                    </h4>
                    <ul className="mt-2 space-y-1 text-lab-pequeno">
                      {c.desfechos.map((o, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Badge tone={tomDoDesfecho[o.nivel]}>{rotuloDoDesfecho[o.nivel]}</Badge>
                          <span className="text-lab-tinta-2">{o.texto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lab-pequeno font-semibold text-lab-tinta">
                      Alternativas escolhidas
                    </h4>
                    <ol className="mt-2 space-y-2 text-lab-pequeno">
                      {c.respostas.map((r) => (
                        <li key={r.perguntaId}>
                          <p className="font-medium text-lab-tinta">{r.prompt}</p>
                          <p className="text-lab-tinta-2">
                            {r.texto}
                            {r.tempoMs !== null ? ` · ${formatarRelogio(r.tempoMs)}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : null}
            </details>
          </li>
        ))}
      </ol>
    </Cartao>
  );
}
