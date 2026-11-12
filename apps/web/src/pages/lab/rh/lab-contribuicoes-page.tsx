import type { LabContribuicaoDoCurador } from "@my-flux/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Select,
  useNotificar
} from "../../../features/leadership-lab/ui";
import { Confirmacao } from "../../../features/leadership-lab/cadastro/confirmacao";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import {
  IdentificacaoDoParticipante,
  SeloDeDecisao
} from "../../../features/leadership-lab/cadastro/situacao-de-curadoria";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import {
  useContribuicoes,
  useDecidirContribuicao
} from "../../../features/leadership-lab/curadoria-hooks";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import { formatarDataEHora } from "../../../features/leadership-lab/rotulos";

const filtros = [
  { value: "pendente", label: "Pendentes" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "rejeitada", label: "Rejeitadas" },
  { value: "todas", label: "Todas" }
];

type Decisao = "aprovada" | "rejeitada";

export function LabContribuicoesPage() {
  const [status, setStatus] = useState("pendente");
  const contribuicoes = useContribuicoes(status);
  const decidir = useDecidirContribuicao();
  const notificar = useNotificar();
  const [pendente, setPendente] = useState<{
    contribuicao: LabContribuicaoDoCurador;
    decisao: Decisao;
  } | null>(null);

  const fechar = () => {
    setPendente(null);
    decidir.reset();
  };

  return (
    <LayoutDoAcompanhamento>
      <p className="max-w-3xl text-lab-pequeno text-lab-tinta-2">
        Ideias que os participantes deram durante o teste para melhorar o procedimento. O texto já
        passou pela proteção de dados. Aprovar ou rejeitar registra a sua decisão e não se desfaz.
      </p>
      <div className="max-w-xs">
        <Select
          label="Mostrar"
          name="filtro-das-contribuicoes"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={filtros}
        />
      </div>
      {contribuicoes.isPending ? (
        <LoadingState />
      ) : contribuicoes.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(contribuicoes.error, "acompanhamento")}
          aoTentarDeNovo={() => void contribuicoes.refetch()}
        />
      ) : contribuicoes.data.length === 0 ? (
        <EmptyState
          title={
            status === "pendente"
              ? "Nenhuma contribuição pendente"
              : "Nenhuma contribuição por aqui"
          }
          description="As ideias dos participantes das suas turmas aparecem aqui."
        />
      ) : (
        <ul className="space-y-3">
          {contribuicoes.data.map((c) => (
            <li
              key={c.id}
              className="space-y-3 rounded-lab-lg border border-lab-linha bg-lab-superficie p-4 shadow-lab-1"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-lab-pequeno">
                  <IdentificacaoDoParticipante {...c.participante} />
                  <span className="mt-1 block text-lab-legenda text-lab-tinta-2">
                    Situação {c.situacao} · {formatarDataEHora(c.criadoEm)}
                  </span>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  {!c.testeConcluido ? <Badge tone="info">Teste em andamento</Badge> : null}
                  <SeloDeDecisao status={c.status} />
                </span>
              </div>
              <p className="text-lab-pequeno leading-6 text-lab-tinta">{c.texto}</p>
              {c.status === "pendente" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    aria-label={`Aprovar a contribuição de ${c.participante.nome}`}
                    onClick={() => setPendente({ contribuicao: c, decisao: "aprovada" })}
                  >
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Rejeitar a contribuição de ${c.participante.nome}`}
                    onClick={() => setPendente({ contribuicao: c, decisao: "rejeitada" })}
                  >
                    Rejeitar
                  </Button>
                </div>
              ) : (
                <p className="text-lab-legenda text-lab-tinta-2">
                  {c.decididoPor ? `Decidida por ${c.decididoPor}` : "Decidida"}
                  {c.decididoEm ? ` em ${formatarDataEHora(c.decididoEm)}` : ""}
                </p>
              )}
              {c.testeConcluido && c.resultadoId ? (
                <Link
                  to={`/lab/rh/revisao/${c.resultadoId}`}
                  className="inline-block text-lab-pequeno font-medium text-lab-destaque-texto hover:underline"
                >
                  Abrir o resultado
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Confirmacao
        aberta={pendente !== null}
        titulo={
          pendente?.decisao === "aprovada"
            ? "Aprovar esta contribuição?"
            : "Rejeitar esta contribuição?"
        }
        descricao="A decisão fica registrada com o seu nome e não se desfaz."
        confirmar={pendente?.decisao === "aprovada" ? "Aprovar" : "Rejeitar"}
        perigosa={pendente?.decisao === "rejeitada"}
        pendente={decidir.isPending}
        erro={
          decidir.isError
            ? descreverErroDoCadastro(decidir.error, "acompanhamento").descricao
            : null
        }
        aoCancelar={fechar}
        aoConfirmar={() => {
          if (pendente) {
            decidir.mutate(
              { id: pendente.contribuicao.id, decisao: pendente.decisao },
              {
                onSuccess: () => {
                  notificar({
                    tom: "sucesso",
                    titulo:
                      pendente.decisao === "aprovada"
                        ? "Contribuição aprovada"
                        : "Contribuição rejeitada"
                  });
                  fechar();
                }
              }
            );
          }
        }}
      />
    </LayoutDoAcompanhamento>
  );
}
