import type { LabPainel, LabSkillDoPainel } from "@my-flux/shared";
import { ArrowRight } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  CabecalhoDePagina,
  Escalonar,
  LoadingState,
  NivelEmSegmentos,
  NumeroAnimado,
  Revelar,
  Skeleton,
  useNotificar
} from "../../features/leadership-lab/ui";
import { classeDoBotao } from "../../features/leadership-lab/ui";
import { cn } from "../../lib/cn";
import { AcaoDoPainel } from "../../features/leadership-lab/componentes/acao-do-painel";
import {
  DicaDaContaDeParticipante,
  FaixaDeDemonstracao
} from "../../features/leadership-lab/componentes/avisos-de-demonstracao";
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
  formatarDataEHora,
  formatarNumero,
  nomeDoAlerta,
  nomeDoTipoDeSkill
} from "../../features/leadership-lab/rotulos";
import { modoDeTesteSemLogin } from "../../modo-de-teste";

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

const comoPorcentagem = (n: number) => `${formatarNumero(n)}%`;

export function LabPainelPage() {
  const painel = usePainel();

  if (painel.isPending) return <LoadingState />;
  if (painel.isError) {
    const erro = descreverErro(painel.error);
    return (
      <Pagina>
        <ErroDaTelaDoLab
          erro={erro}
          aoTentarDeNovo={() => void painel.refetch()}
          {...(erro.tipo === "sem-acesso" && modoDeTesteSemLogin()
            ? { acao: <DicaDaContaDeParticipante /> }
            : {})}
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
    <Escalonar className="space-y-8">
      <Revelar>
        <CabecalhoDePagina
          eyebrow="MY FLUX · Desenvolvimento"
          titulo="Leadership Lab"
          descricao="Treine decisões de liderança com situações do dia a dia e acompanhe a sua evolução."
        />
      </Revelar>
      {children}
    </Escalonar>
  );
}

function PainelCompleto({ painel }: { painel: LabPainel }) {
  const navigate = useNavigate();
  const notificar = useNotificar();
  const aceitarTermo = useAceitarTermo();
  const iniciar = useIniciarTeste();
  const { indicadores, evolucao } = painel;

  return (
    <>
      {painel.demonstracao ? <FaixaDeDemonstracao /> : null}
      {painel.termo.aceito ? null : (
        <TermoDeCiencia
          versao={painel.termo.versaoAtual}
          aceitando={aceitarTermo.isPending}
          erro={aceitarTermo.error ? descreverErro(aceitarTermo.error) : null}
          aoAceitar={() =>
            aceitarTermo.mutate(undefined, {
              onSuccess: () =>
                notificar({
                  tom: "sucesso",
                  titulo: "Termo registrado",
                  descricao: "Você já pode iniciar o seu teste."
                })
            })
          }
        />
      )}

      <AcaoDoPainel
        acao={painel.acao}
        iniciando={iniciar.isPending}
        erroAoIniciar={iniciar.error ? descreverErro(iniciar.error) : null}
        demonstracao={painel.demonstracao}
        aoIniciar={(categoriaId) =>
          iniciar.mutate(categoriaId, {
            onSuccess: (resposta) =>
              navigate(
                resposta.tipo === "situacao" ? "/lab/teste" : `/lab/resultado/${resposta.sessaoId}`
              )
          })
        }
      />

      {painel.termo.aceito && painel.acao.tipo !== "continuar" ? (
        <p className="text-lab-pequeno text-lab-tinta-2">
          Quer estudar antes ou depois de um teste?{" "}
          <Link
            to="/lab/aprendizagem"
            className="font-medium text-lab-destaque underline underline-offset-2"
          >
            Abrir o espaço de aprendizagem
          </Link>
          . Sem nota, com o facilitador.
        </p>
      ) : null}

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Estatistica
          rotulo="Testes feitos"
          href="#seus-testes"
          valor={<NumeroAnimado valor={indicadores.testesFeitos} formatar={String} />}
          detalhe={
            indicadores.testesFeitos === 0
              ? "Faça o primeiro teste"
              : `${indicadores.testesValidados} ${indicadores.testesValidados === 1 ? "validado" : "validados"} pelo RH`
          }
        />
        <Estatistica
          rotulo="Aderência média"
          href="#evolucao"
          valor={
            indicadores.aderenciaMedia === null ? (
              "—"
            ) : (
              <NumeroAnimado valor={indicadores.aderenciaMedia} formatar={comoPorcentagem} />
            )
          }
          {...(indicadores.aderenciaMedia === null
            ? {}
            : { anel: { valor: indicadores.aderenciaMedia } })}
          detalhe="Quanto suas escolhas combinam com o estilo adequado"
        />
        <Estatistica
          rotulo="Agilidade média"
          href="#evolucao"
          valor={
            indicadores.agilidadeMedia === null ? (
              "—"
            ) : (
              <NumeroAnimado valor={indicadores.agilidadeMedia} formatar={comoPorcentagem} />
            )
          }
          {...(indicadores.agilidadeMedia === null
            ? {}
            : { anel: { valor: indicadores.agilidadeMedia, tom: "info" as const } })}
          detalhe="Quão rápido você decide, dentro do tempo"
        />
        <Estatistica
          rotulo="Último teste"
          href="#seus-testes"
          valor={indicadores.ultimoTesteEm ? formatarDataCurta(indicadores.ultimoTesteEm) : "—"}
        />
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-3">
        <Cartao
          id="evolucao"
          className="xl:col-span-2"
          titulo="Sua evolução"
          descricao="Aderência e agilidade de cada teste concluído."
        >
          {evolucao.pontos.length === 0 ? (
            <p className="rounded-lab-md border border-dashed border-lab-linha-forte bg-lab-superficie-2 p-5 text-lab-pequeno leading-6 text-lab-tinta-2">
              Sua evolução aparece aqui depois do primeiro teste concluído. Comece pelo bloco de
              início, no topo da página.
            </p>
          ) : (
            <>
              <Suspense fallback={<AguardandoGrafico />}>
                <GraficoDeEvolucao pontos={evolucao.pontos} />
              </Suspense>
              <details className="group mt-5 text-lab-pequeno">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-lab-tinta-2 transition-colors hover:text-lab-destaque-texto">
                  Ver os números em tabela
                </summary>
                <div className="rolagem-fina mt-3 overflow-x-auto">
                  <table className="w-full text-left text-lab-pequeno">
                    <thead className="text-lab-legenda text-lab-tinta-2">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Teste</th>
                        <th className="py-2 pr-4 font-medium">Data</th>
                        <th className="py-2 pr-4 font-medium">Aderência</th>
                        <th className="py-2 pr-4 font-medium">Agilidade</th>
                        <th className="py-2 font-medium">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosDaEvolucao(evolucao.pontos).map((p) => (
                        <tr key={p.rotulo} className="border-t border-lab-linha">
                          <td className="py-2.5 pr-4">{p.rotulo}</td>
                          <td className="py-2.5 pr-4">{p.data}</td>
                          <td className="tabular py-2.5 pr-4">{formatarNumero(p.aderencia)}%</td>
                          <td className="tabular py-2.5 pr-4">{formatarNumero(p.agilidade)}%</td>
                          <td className="py-2.5">
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
                </div>
              </details>
            </>
          )}
          {evolucao.tendenciaDisponivel ? null : (
            <p className="mt-5 text-lab-legenda text-lab-tinta-2">
              A tendência da sua evolução aparece depois de 3 testes concluídos (você fez{" "}
              {indicadores.testesFeitos}).
            </p>
          )}
        </Cartao>

        <Cartao
          id="seus-testes"
          titulo="Seus testes"
          descricao="Abra um resultado para rever as suas escolhas, o nível validado pelo RH e, se discordar de algum ponto, contestar."
        >
          {evolucao.pontos.length === 0 ? (
            <p className="text-lab-pequeno text-lab-tinta-2">
              Quando você concluir um teste, ele aparece aqui, com o link para o resultado.
            </p>
          ) : (
            <ul className="rolagem-fina -my-1 max-h-[26rem] divide-y divide-lab-linha overflow-y-auto pr-1">
              {[...evolucao.pontos].reverse().map((ponto) => (
                <li
                  key={ponto.resultadoId}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3.5"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="tabular text-lab-pequeno font-medium text-lab-tinta">
                      {formatarDataEHora(ponto.concluidaEm)}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-lab-pequeno text-lab-tinta-2">
                      <span>Aderência {formatarNumero(ponto.aderenciaGeral)}%</span>
                      <SeloDeValidacao status={ponto.statusValidacao} />
                    </p>
                  </div>
                  <Link
                    to={`/lab/resultado/${ponto.sessaoId}`}
                    aria-label={`Ver o resultado do teste de ${formatarDataEHora(ponto.concluidaEm)}`}
                    className={cn(classeDoBotao("secondary", "sm"), "group")}
                  >
                    Ver resultado
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                      className="transition-transform duration-lab group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <Cartao
        id="skills"
        titulo="Suas skills"
        descricao="O nível mais recente de cada skill, de 1 a 5. O nível validado pelo RH, quando houver, substitui o calculado."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          {painel.skills.some((s) => s.nivel !== null) ? (
            <Suspense fallback={<AguardandoGrafico />}>
              <RadarDeSkills skills={painel.skills} />
            </Suspense>
          ) : (
            <p className="self-center text-lab-pequeno text-lab-tinta-2">
              O radar das suas skills aparece depois do primeiro teste concluído.
            </p>
          )}
          <ul className="divide-y divide-lab-linha">
            {painel.skills.map((skill) => (
              <LinhaDeSkill key={skill.skillId} skill={skill} />
            ))}
          </ul>
        </div>
      </Cartao>

      <div className="grid gap-8 xl:grid-cols-2">
        <Cartao
          className={painel.sugestoes.itens.length > 0 ? "" : "xl:col-span-2"}
          titulo="Seu estilo de liderança"
          descricao="Como você costuma conduzir a equipe, a partir das suas escolhas."
        >
          {painel.tipoDePerfil.disponivel ? (
            <QuadranteDeEstilos perfil={painel.tipoDePerfil} />
          ) : (
            <p className="text-lab-pequeno leading-6 text-lab-tinta-2">
              Seu perfil aparece depois de {painel.tipoDePerfil.testesNecessarios} testes
              concluídos. Você fez {painel.tipoDePerfil.testesFeitos}.
            </p>
          )}
        </Cartao>

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
            <ul className="space-y-3">
              {painel.sugestoes.itens.map((sugestao) => (
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
      </div>

      {painel.alertas.length > 0 ? (
        <Cartao
          titulo="Alertas abertos"
          descricao="Pontos que merecem atenção, vindos de testes concluídos."
        >
          <ul className="divide-y divide-lab-linha">
            {painel.alertas.map((alerta) => (
              <li
                key={alerta.id}
                className="flex flex-wrap items-center gap-3 py-3 text-lab-pequeno text-lab-tinta"
              >
                <Badge dot tone={alerta.cor === "vermelho" ? "danger" : "warning"}>
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
    </>
  );
}

function LinhaDeSkill({ skill }: { skill: LabSkillDoPainel }) {
  const nivel = skill.nivel;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3.5">
      <div className="min-w-0 space-y-1">
        <p className="text-lab-pequeno font-medium text-lab-tinta">{skill.nome}</p>
        <p className="flex flex-wrap items-center gap-2 text-lab-legenda text-lab-tinta-2">
          {nomeDoTipoDeSkill[skill.tipo]}
          {nivel === null || skill.validado ? null : (
            <Badge tone="warning">Aguardando validação</Badge>
          )}
        </p>
      </div>
      {nivel === null ? (
        <span className="text-lab-legenda text-lab-tinta-2">Sem evidência ainda</span>
      ) : (
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
      )}
    </li>
  );
}
