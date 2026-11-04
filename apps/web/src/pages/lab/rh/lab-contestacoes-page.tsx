import { type LabContestacaoDoCurador, labLimitesDeTexto } from "@my-flux/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState, LoadingState, Modal, Select } from "../../../components/ui";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import {
  IdentificacaoDoParticipante,
  SeloDeDecisao
} from "../../../features/leadership-lab/cadastro/situacao-de-curadoria";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { SeloDeValidacao } from "../../../features/leadership-lab/componentes/selo-de-validacao";
import {
  useContestacoes,
  useDecidirContestacao
} from "../../../features/leadership-lab/curadoria-hooks";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import { formatarDataEHora } from "../../../features/leadership-lab/rotulos";

const filtros = [
  { value: "pendente", label: "Pendentes" },
  { value: "aceita", label: "Aceitas" },
  { value: "rejeitada", label: "Rejeitadas" },
  { value: "todas", label: "Todas" }
];

export function LabContestacoesPage() {
  const [status, setStatus] = useState("pendente");
  const contestacoes = useContestacoes(status);
  const [aDecidir, setADecidir] = useState<LabContestacaoDoCurador | null>(null);

  return (
    <LayoutDoAcompanhamento>
      <p className="max-w-3xl text-sm text-slate-600">
        O participante pode questionar um ponto do próprio resultado. A sua decisão e a nota
        explicativa chegam a ele. Decidir não altera o resultado sozinho: o ajuste de um nível é
        feito na validação, enquanto o resultado aguarda validação.
      </p>
      <div className="max-w-xs">
        <Select
          label="Mostrar"
          name="filtro-das-contestacoes"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={filtros}
        />
      </div>
      {contestacoes.isPending ? (
        <LoadingState />
      ) : contestacoes.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(contestacoes.error, "acompanhamento")}
          aoTentarDeNovo={() => void contestacoes.refetch()}
        />
      ) : contestacoes.data.length === 0 ? (
        <EmptyState
          title={
            status === "pendente" ? "Nenhuma contestação pendente" : "Nenhuma contestação por aqui"
          }
          description="As contestações dos participantes das suas turmas aparecem aqui."
        />
      ) : (
        <ul className="space-y-3">
          {contestacoes.data.map((c) => (
            <li
              key={c.id}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <IdentificacaoDoParticipante {...c.participante} />
                  <span className="mt-1 block text-xs text-slate-500">
                    Contestou em {formatarDataEHora(c.criadoEm)}
                  </span>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  <SeloDeValidacao status={c.statusValidacao} />
                  <SeloDeDecisao status={c.status} />
                </span>
              </div>
              <div className="text-sm leading-6">
                <p className="font-medium text-slate-900">{c.ponto}</p>
                <p className="text-slate-700">{c.motivo}</p>
              </div>
              {c.status !== "pendente" ? (
                <p className="border-l-2 border-slate-200 pl-3 text-sm leading-6 text-slate-600">
                  Decisão{c.decididoPor ? ` de ${c.decididoPor}` : ""}
                  {c.decididoEm ? ` em ${formatarDataEHora(c.decididoEm)}` : ""}: {c.nota}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                {c.status === "pendente" ? (
                  <Button
                    size="sm"
                    aria-label={`Decidir a contestação de ${c.participante.nome}`}
                    onClick={() => setADecidir(c)}
                  >
                    Decidir
                  </Button>
                ) : null}
                <Link
                  to={`/lab/rh/revisao/${c.resultadoId}`}
                  className="text-sm font-medium text-emerald-800 hover:underline"
                >
                  Abrir o resultado
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        isOpen={aDecidir !== null}
        title="Decidir contestação"
        description="A decisão e a nota chegam ao participante e não se desfazem."
        onClose={() => setADecidir(null)}
      >
        {/* O conteúdo só existe com o modal aberto: abrir de novo começa do zero. */}
        {aDecidir ? (
          <FormularioDaDecisao contestacao={aDecidir} aoFechar={() => setADecidir(null)} />
        ) : null}
      </Modal>
    </LayoutDoAcompanhamento>
  );
}

function FormularioDaDecisao({
  contestacao,
  aoFechar
}: {
  contestacao: LabContestacaoDoCurador;
  aoFechar: () => void;
}) {
  const decidir = useDecidirContestacao();
  const [decisao, setDecisao] = useState<"aceita" | "rejeitada" | null>(null);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const jaValidado = contestacao.statusValidacao !== "aguardando_validacao";

  const enviar = () => {
    if (decisao === null) {
      setAviso("Escolha se a contestação é aceita ou rejeitada.");
      return;
    }
    if (nota.trim() === "") {
      setAviso("Escreva a nota: é ela que explica a decisão ao participante.");
      return;
    }
    setAviso(null);
    decidir.mutate({ id: contestacao.id, decisao, nota: nota.trim() }, { onSuccess: aoFechar });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <div className="text-sm">
        <p className="font-medium text-slate-900">{contestacao.ponto}</p>
        <p className="mt-1 leading-6 text-slate-700">{contestacao.motivo}</p>
      </div>
      <p role="note" className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        {jaValidado
          ? "Este resultado já foi validado, e uma validação não se refaz: a decisão fica registrada, mas o resultado não muda."
          : "Aceitar registra a decisão e a nota. Se o nível de alguma skill deve mudar, faça o ajuste ao validar o resultado."}
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Decisão</legend>
        {(
          [
            ["aceita", "Aceitar a contestação"],
            ["rejeitada", "Rejeitar a contestação"]
          ] as const
        ).map(([valor, rotulo]) => (
          <label key={valor} className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              name="decisao-da-contestacao"
              className="h-4 w-4 accent-emerald-700"
              checked={decisao === valor}
              onChange={() => setDecisao(valor)}
            />
            {rotulo}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2 text-sm font-medium text-slate-700">
        <label htmlFor="nota-da-contestacao">Nota para o participante</label>
        <textarea
          id="nota-da-contestacao"
          rows={4}
          maxLength={labLimitesDeTexto.nota}
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <span className="text-xs font-normal text-slate-500">
          {nota.length}/{labLimitesDeTexto.nota}
        </span>
      </div>
      {aviso ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {aviso}
        </p>
      ) : null}
      {decidir.isError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {descreverErroDoCadastro(decidir.error, "acompanhamento").descricao}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={aoFechar} disabled={decidir.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={decidir.isPending}>
          {decidir.isPending ? "Registrando..." : "Registrar decisão"}
        </Button>
      </div>
    </form>
  );
}
