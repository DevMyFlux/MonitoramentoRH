import type { LabPainel, LabSkillDoPainel } from "@my-flux/shared";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, LoadingState, Skeleton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { AcaoDoPainel } from "../../features/leadership-lab/componentes/acao-do-painel";
import { Cartao, Estatistica } from "../../features/leadership-lab/componentes/cartao";
import { ErroDaTelaDoLab } from "../../features/leadership-lab/componentes/erro-da-tela";
import { QuadranteDeEstilos } from "../../features/leadership-lab/componentes/quadrante-de-estilos";
import { SeloDeValidacao } from "../../features/leadership-lab/componentes/selo-de-validacao";
import { TermoDeCiencia } from "../../features/leadership-lab/componentes/termo-de-ciencia";
import { dadosDaEvolucao } from "../../features/leadership-lab/dados-dos-graficos";
import { descreverErro } from "../../features/leadership-lab/erros";
import { useAceitarTermo, useIniciarTeste, usePainel } from "../../features/leadership-lab/hooks";
import {
  formatarDataCurta,
  formatarNumero,
  nomeDoAlerta,
  nomeDoTipoDeSkill
} from "../../features/leadership-lab/rotulos";

const RadarDeSkills = lazy(() =>
  import("../../features/leadership-lab/componentes/graficos").then((m) => ({
    default: m.RadarDeSkills
  }))
);
const GraficoDeEvolucao = lazy(() =>
  import("../../features/leadership-lab/componentes/graficos").then((m) => ({
    default: m.GraficoDeEvolucao
  }))
);

const AguardandoGrafico = () => (
  <Skeleton className="h-72 w-full" aria-label="Carregando gráfico" />
);

export function LabPainelPage() {
  const painel = usePainel();

  if (painel.isPending) return <LoadingState />;
  if (painel.isError) {
    return (
      <Pagina>
        <ErroDaTelaDoLab
          erro={descreverErro(painel.error)}
          aoTentarDeNovo={() => void painel.refetch()}
        />
      </Pagina>
    );
  }
  return (
    <Pagina>
      <PainelCompleto painel={painel.data} />
    </Pagina>
  );
}

function Pagina({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-emerald-800">
          MY FLUX · Desenvolvimento
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Leadership Lab</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Treine decisões de liderança com situações do dia a dia e acompanhe a sua evolução.
        </p>
      </div>
      {children}
    </div>
  );
}

function PainelCompleto({ painel }: { painel: LabPainel }) {
  const navigate = useNavigate();
  const aceitarTermo = useAceitarTermo();
  const iniciar = useIniciarTeste();
  const { indicadores, evolucao } = painel;

  return (
    <>
      {painel.termo.aceito ? null : (
        <TermoDeCiencia
          versao={painel.termo.versaoAtual}
          aceitando={aceitarTermo.isPending}
          erro={aceitarTermo.error ? descreverErro(aceitarTermo.error) : null}
          aoAceitar={() => aceitarTermo.mutate()}
        />
      )}

      <AcaoDoPainel
        acao={painel.acao}
        iniciando={iniciar.isPending}
        erroAoIniciar={iniciar.error ? descreverErro(iniciar.error) : null}
        aoIniciar={() =>
          iniciar.mutate(undefined, {
            onSuccess: (resposta) =>
              navigate(
                resposta.tipo === "situacao" ? "/lab/teste" : `/lab/resultado/${resposta.sessaoId}`
              )
          })
        }
      />

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Estatistica
          rotulo="Testes feitos"
          valor={indicadores.testesFeitos}
          detalhe={
            indicadores.testesFeitos === 0
              ? "Faça o primeiro teste"
              : `${indicadores.testesValidados} ${indicadores.testesValidados === 1 ? "validado" : "validados"} pelo RH`
          }
        />
        <Estatistica
          rotulo="Aderência média"
          valor={
            indicadores.aderenciaMedia === null
              ? "—"
              : `${formatarNumero(indicadores.aderenciaMedia)}%`
          }
          detalhe="Quanto suas escolhas combinam com o estilo adequado"
        />
        <Estatistica
          rotulo="Agilidade média"
          valor={
            indicadores.agilidadeMedia === null
              ? "—"
              : `${formatarNumero(indicadores.agilidadeMedia)}%`
          }
          detalhe="Quão rápido você decide, dentro do tempo"
        />
        <Estatistica
          rotulo="Último teste"
          valor={indicadores.ultimoTesteEm ? formatarDataCurta(indicadores.ultimoTesteEm) : "—"}
        />
      </section>

      <Cartao titulo="Sua evolução" descricao="Aderência e agilidade de cada teste concluído.">
        {evolucao.pontos.length === 0 ? (
          <p className="text-sm text-slate-500">Seus testes concluídos aparecem aqui.</p>
        ) : (
          <>
            <Suspense fallback={<AguardandoGrafico />}>
              <GraficoDeEvolucao pontos={evolucao.pontos} />
            </Suspense>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-slate-600 hover:text-emerald-800">
                Ver os números em tabela
              </summary>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Teste</th>
                    <th className="py-1 pr-3 font-medium">Data</th>
                    <th className="py-1 pr-3 font-medium">Aderência</th>
                    <th className="py-1 pr-3 font-medium">Agilidade</th>
                    <th className="py-1 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosDaEvolucao(evolucao.pontos).map((p) => (
                    <tr key={p.rotulo} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3">{p.rotulo}</td>
                      <td className="py-1.5 pr-3">{p.data}</td>
                      <td className="py-1.5 pr-3">{formatarNumero(p.aderencia)}%</td>
                      <td className="py-1.5 pr-3">{formatarNumero(p.agilidade)}%</td>
                      <td className="py-1.5">
                        {p.aguardandoValidacao ? (
                          <Badge tone="warning">Aguardando validação</Badge>
                        ) : (
                          <Badge tone="success">Validado</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
        {evolucao.tendenciaDisponivel ? null : (
          <p className="mt-4 text-xs text-slate-500">
            A tendência da sua evolução aparece depois de 3 testes concluídos (você fez{" "}
            {indicadores.testesFeitos}).
          </p>
        )}
      </Cartao>

      <Cartao
        titulo="Suas skills"
        descricao="O nível mais recente de cada skill, de 1 a 5. O nível validado pelo RH, quando houver, substitui o calculado."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {painel.skills.some((s) => s.nivel !== null) ? (
            <Suspense fallback={<AguardandoGrafico />}>
              <RadarDeSkills skills={painel.skills} />
            </Suspense>
          ) : (
            <p className="self-center text-sm text-slate-500">
              O radar das suas skills aparece depois do primeiro teste concluído.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {painel.skills.map((skill) => (
              <LinhaDeSkill key={skill.skillId} skill={skill} />
            ))}
          </ul>
        </div>
      </Cartao>

      <Cartao
        titulo="Seu estilo de liderança"
        descricao="Como você costuma conduzir a equipe, a partir das suas escolhas."
      >
        {painel.tipoDePerfil.disponivel ? (
          <QuadranteDeEstilos perfil={painel.tipoDePerfil} />
        ) : (
          <p className="text-sm text-slate-600">
            Seu perfil aparece depois de {painel.tipoDePerfil.testesNecessarios} testes concluídos.
            Você fez {painel.tipoDePerfil.testesFeitos}.
          </p>
        )}
      </Cartao>

      {painel.alertas.length > 0 ? (
        <Cartao
          titulo="Alertas abertos"
          descricao="Pontos que merecem atenção, vindos de testes concluídos."
        >
          <ul className="space-y-3">
            {painel.alertas.map((alerta) => (
              <li
                key={alerta.id}
                className="flex flex-wrap items-center gap-3 text-sm text-slate-700"
              >
                <Badge tone={alerta.cor === "vermelho" ? "danger" : "warning"}>
                  {nomeDoAlerta[alerta.cor]}
                </Badge>
                <span>
                  {alerta.cor === "vermelho"
                    ? `Situação ${alerta.situacao ?? "—"}`
                    : `${alerta.skill?.nome ?? "Skill"}: média abaixo de 50 em dois testes seguidos`}
                  {alerta.teste.concluidaEm
                    ? ` · teste de ${formatarDataCurta(alerta.teste.concluidaEm)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      {painel.sugestoes.itens.length > 0 ? (
        <Cartao
          titulo="Sugestões para você"
          {...(painel.sugestoes.origem
            ? { acao: <SeloDeValidacao status={painel.sugestoes.origem.statusValidacao} /> }
            : {})}
          descricao={
            painel.sugestoes.origem
              ? `Do seu teste de ${formatarDataCurta(painel.sugestoes.origem.concluidaEm)}.`
              : "Do seu último teste."
          }
        >
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {painel.sugestoes.itens.map((sugestao) => (
              <li key={sugestao}>{sugestao}</li>
            ))}
          </ul>
        </Cartao>
      ) : null}
    </>
  );
}

function LinhaDeSkill({ skill }: { skill: LabSkillDoPainel }) {
  const nivel = skill.nivel;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div>
        <p className="text-sm font-medium text-slate-900">{skill.nome}</p>
        <p className="text-xs text-slate-500">{nomeDoTipoDeSkill[skill.tipo]}</p>
      </div>
      {nivel === null ? (
        <span className="text-xs text-slate-500">Sem evidência ainda</span>
      ) : (
        <div className="flex items-center gap-3">
          {skill.validado ? null : <Badge tone="warning">Aguardando validação</Badge>}
          <span className="sr-only">Nível {nivel} de 5</span>
          <span aria-hidden="true" className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={cn("h-2 w-4 rounded-sm", n <= nivel ? "bg-emerald-600" : "bg-slate-200")}
              />
            ))}
          </span>
          <span aria-hidden="true" className="w-8 text-right text-sm font-semibold text-slate-900">
            {nivel}/5
          </span>
        </div>
      )}
    </li>
  );
}
