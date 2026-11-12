import type { LabItemDaRevisao } from "@my-flux/shared";
import { ArrowRight } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  BotaoLink,
  EmptyState,
  Escalonar,
  NumeroAnimado,
  Skeleton,
  classeDoBotao
} from "../../../features/leadership-lab/ui";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import { useParticipantes, useTurmas } from "../../../features/leadership-lab/cadastro-hooks";
import { Cartao, Estatistica } from "../../../features/leadership-lab/componentes/cartao";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { SeloDeValidacao } from "../../../features/leadership-lab/componentes/selo-de-validacao";
import { usePendencias, useRevisao } from "../../../features/leadership-lab/curadoria-hooks";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import { formatarDataEHora, formatarNumero } from "../../../features/leadership-lab/rotulos";
import {
  distribuicaoDaAderencia,
  resultadosPorTeste,
  resumoDosResultados
} from "../../../features/leadership-lab/visao-geral-dados";
import { cn } from "../../../lib/cn";

const DistribuicaoDeAderencia = lazy(() =>
  import("../../../features/leadership-lab/componentes/graficos").then((m) => ({
    default: m.DistribuicaoDeAderencia
  }))
);

const ULTIMOS = 5;

/** Um número ainda não chegou (ou não veio): traço, nunca zero. */
const ouTraco = (n: number | undefined) =>
  n === undefined ? "—" : <NumeroAnimado valor={n} formatar={String} />;

/**
 * A visão geral do acompanhamento: o que espera o curador, como estão os resultados das turmas dele
 * e o tamanho do cadastro. Tudo vem das mesmas consultas das outras abas (e do mesmo escopo): nada
 * é calculado sobre dados que o RH não possa ver.
 */
export function LabVisaoGeralPage() {
  return (
    <LayoutDoAcompanhamento>
      <Escalonar className="space-y-8">
        <Pendencias />
        <Resultados />
        <Cadastro />
      </Escalonar>
    </LayoutDoAcompanhamento>
  );
}

function Pendencias() {
  const pendencias = usePendencias();
  const n = pendencias.data;
  const detalhe = (quantidade: number | undefined, vazio: string, cheio: string) =>
    pendencias.isError
      ? "Não foi possível carregar agora"
      : quantidade === undefined
        ? "Carregando..."
        : quantidade === 0
          ? vazio
          : cheio;
  return (
    <section aria-label="Pendências" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Estatistica
        rotulo="Resultados a validar"
        para="/lab/rh/revisao"
        valor={ouTraco(n?.resultadosAguardando)}
        detalhe={detalhe(
          n?.resultadosAguardando,
          "Nada aguardando você",
          "Abrir a fila de revisão"
        )}
      />
      <Estatistica
        rotulo="Alertas abertos"
        para="/lab/rh/alertas"
        valor={ouTraco(n?.alertasAbertos)}
        detalhe={detalhe(n?.alertasAbertos, "Nenhum alerta aberto", "Ver e tratar os alertas")}
      />
      <Estatistica
        rotulo="Contestações pendentes"
        para="/lab/rh/contestacoes"
        valor={ouTraco(n?.contestacoesPendentes)}
        detalhe={detalhe(
          n?.contestacoesPendentes,
          "Nenhuma contestação pendente",
          "Responder às contestações"
        )}
      />
      <Estatistica
        rotulo="Contribuições pendentes"
        para="/lab/rh/contribuicoes"
        valor={ouTraco(n?.contribuicoesPendentes)}
        detalhe={detalhe(
          n?.contribuicoesPendentes,
          "Nenhuma contribuição pendente",
          "Avaliar as contribuições"
        )}
      />
    </section>
  );
}

function Resultados() {
  const revisao = useRevisao("todos");

  if (revisao.isPending) {
    return (
      <div role="status" aria-label="Carregando os resultados" className="space-y-4">
        <Skeleton className="h-72 rounded-lab-lg" />
        <Skeleton className="h-40 rounded-lab-lg" />
      </div>
    );
  }
  if (revisao.isError) {
    return (
      <ErroDaTelaDoLab
        erro={descreverErroDoCadastro(revisao.error, "acompanhamento")}
        aoTentarDeNovo={() => void revisao.refetch()}
      />
    );
  }
  if (revisao.data.length === 0) {
    return (
      <EmptyState
        title="Ainda não há resultados para acompanhar"
        description="Os indicadores aparecem quando um participante das suas turmas concluir um teste. Confira se as turmas estão ativas e com participantes."
        action={
          <BotaoLink to="/lab/rh/turmas" variant="secondary">
            Ver as turmas
          </BotaoLink>
        }
      />
    );
  }
  return <ResultadosDasTurmas itens={revisao.data} />;
}

function ResultadosDasTurmas({ itens }: { itens: LabItemDaRevisao[] }) {
  const resumo = resumoDosResultados(itens);
  const porTeste = resultadosPorTeste(itens);
  return (
    <>
      <div className="grid items-start gap-8 xl:grid-cols-3">
        <Cartao
          className="xl:col-span-2"
          titulo="Resultados das suas turmas"
          descricao={
            resumo.parcial
              ? `Calculado sobre os ${resumo.total} resultados mais recentes (o limite da lista).`
              : "Todos os testes concluídos pelos participantes que você acompanha."
          }
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Medida rotulo="Testes concluídos" valor={String(resumo.total)} />
            <Medida rotulo="Participantes com teste" valor={String(resumo.participantes)} />
            <Medida
              rotulo="Aderência média"
              valor={
                resumo.aderenciaMedia === null ? "—" : `${formatarNumero(resumo.aderenciaMedia)}%`
              }
            />
            <Medida
              rotulo="Agilidade média"
              valor={
                resumo.agilidadeMedia === null ? "—" : `${formatarNumero(resumo.agilidadeMedia)}%`
              }
            />
          </dl>
          <h3 className="mt-7 text-lab-pequeno font-semibold text-lab-tinta">
            Distribuição da aderência
          </h3>
          <p className="mt-1 text-lab-legenda text-lab-tinta-2">
            Quantos resultados ficaram em cada faixa. {resumo.validados} de {resumo.total}{" "}
            {resumo.total === 1 ? "já foi validado" : "já foram validados"} por um curador.
          </p>
          <div className="mt-3">
            <Suspense
              fallback={<Skeleton className="h-64 w-full" aria-label="Carregando gráfico" />}
            >
              <DistribuicaoDeAderencia faixas={distribuicaoDaAderencia(itens)} />
            </Suspense>
          </div>
        </Cartao>

        <Cartao
          titulo="Últimos testes"
          descricao="Os mais recentes das suas turmas."
          acao={
            <Link to="/lab/rh/revisao" className={cn(classeDoBotao("ghost", "sm"), "-mr-2")}>
              Ver todos
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          <ul className="-my-1 divide-y divide-lab-linha">
            {itens.slice(0, ULTIMOS).map((item) => (
              <li key={item.resultadoId} className="py-3.5">
                <Link
                  to={`/lab/rh/revisao/${item.resultadoId}`}
                  aria-label={`Abrir o resultado de ${item.participante.nome}, de ${formatarDataEHora(item.concluidaEm)}`}
                  className="group block rounded-lab-sm"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-lab-pequeno font-medium text-lab-tinta group-hover:text-lab-destaque-texto">
                      {item.participante.nome}
                    </span>
                    <span className="tabular shrink-0 text-lab-pequeno font-semibold text-lab-tinta">
                      {formatarNumero(item.aderenciaGeral)}%
                    </span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-lab-legenda text-lab-tinta-2">
                    <span className="tabular">
                      {item.moldeNome} · {formatarDataEHora(item.concluidaEm)}
                    </span>
                    <SeloDeValidacao status={item.statusValidacao} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>

      {porTeste.length > 1 ? (
        <Cartao
          titulo="Por teste"
          descricao="As médias de cada teste de cargo, para comparar os grupos."
        >
          <div className="rolagem-fina -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[28rem] text-left text-lab-pequeno">
              <thead className="text-lab-legenda text-lab-tinta-2">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium normal-case tracking-normal">
                    Teste
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium normal-case tracking-normal">
                    Resultados
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium normal-case tracking-normal">
                    Aderência média
                  </th>
                  <th scope="col" className="py-2 font-medium normal-case tracking-normal">
                    Agilidade média
                  </th>
                </tr>
              </thead>
              <tbody>
                {porTeste.map((linha) => (
                  <tr key={linha.teste} className="border-t border-lab-linha">
                    <th scope="row" className="py-3 pr-4 font-medium text-lab-tinta">
                      {linha.teste}
                    </th>
                    <td className="tabular py-3 pr-4">{linha.resultados}</td>
                    <td className="tabular py-3 pr-4">{formatarNumero(linha.aderenciaMedia)}%</td>
                    <td className="tabular py-3">{formatarNumero(linha.agilidadeMedia)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      ) : null}
    </>
  );
}

function Medida({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-lab-legenda text-lab-tinta-2">{rotulo}</dt>
      <dd className="tabular mt-1.5 text-[1.75rem] font-semibold leading-none tracking-[-0.02em] text-lab-tinta">
        {valor}
      </dd>
    </div>
  );
}

/** O tamanho do cadastro. Se uma das consultas falhar, o número vira traço: nada depende dele. */
function Cadastro() {
  const participantes = useParticipantes();
  const turmas = useTurmas();
  const ativos = participantes.data?.filter((p) => p.ativo).length;
  const turmasAtivas = turmas.data?.filter((t) => t.ativa).length;
  const total = (lista: readonly unknown[] | undefined, falhou: boolean, nome: string) =>
    falhou
      ? "Não foi possível carregar agora"
      : lista === undefined
        ? "Carregando..."
        : `${lista.length} ${nome} no total`;
  return (
    <section aria-label="Cadastro" className="grid gap-4 sm:grid-cols-2">
      <Estatistica
        rotulo="Participantes ativos"
        para="/lab/rh/participantes"
        valor={ouTraco(ativos)}
        detalhe={total(participantes.data, participantes.isError, "cadastrados")}
      />
      <Estatistica
        rotulo="Turmas ativas"
        para="/lab/rh/turmas"
        valor={ouTraco(turmasAtivas)}
        detalhe={total(turmas.data, turmas.isError, "turmas")}
      />
    </section>
  );
}
