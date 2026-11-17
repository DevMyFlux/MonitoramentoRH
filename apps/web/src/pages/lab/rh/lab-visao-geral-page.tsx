import {
  BotaoLink,
  EmptyState,
  Escalonar,
  NumeroAnimado,
  Skeleton
} from "../../../features/leadership-lab/ui";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import { useParticipantes, useTurmas } from "../../../features/leadership-lab/cadastro-hooks";
import { Estatistica } from "../../../features/leadership-lab/componentes/cartao";
import { PainelDeAnalise } from "../../../features/leadership-lab/componentes/painel-de-analise";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { usePendencias, useRevisao } from "../../../features/leadership-lab/curadoria-hooks";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";

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
  return <PainelDeAnalise itens={revisao.data} />;
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
