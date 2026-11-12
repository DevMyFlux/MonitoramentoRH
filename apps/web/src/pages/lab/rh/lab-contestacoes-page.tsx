import { type LabContestacaoDoCurador, labLimitesDeTexto } from "@my-flux/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  classeDaSuperficie,
  EmptyState,
  LoadingState,
  Marcacao,
  MensagemDeErro,
  Modal,
  Select,
  Textarea,
  useNotificar
} from "../../../features/leadership-lab/ui";
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
import { cn } from "../../../lib/cn";

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
      <p className="max-w-3xl text-lab-pequeno text-lab-tinta-2">
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
            <li key={c.id} className={cn(classeDaSuperficie, "space-y-3 p-4")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-lab-pequeno">
                  <IdentificacaoDoParticipante {...c.participante} />
                  <span className="mt-1 block text-lab-legenda text-lab-tinta-2">
                    Contestou em {formatarDataEHora(c.criadoEm)}
                  </span>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  <SeloDeValidacao status={c.statusValidacao} />
                  <SeloDeDecisao status={c.status} />
                </span>
              </div>
              <div className="text-lab-pequeno leading-6">
                <p className="font-medium text-lab-tinta">{c.ponto}</p>
                <p className="text-lab-tinta-2">{c.motivo}</p>
              </div>
              {c.status !== "pendente" ? (
                <p className="border-l-2 border-lab-linha pl-3 text-lab-pequeno leading-6 text-lab-tinta-2">
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
                  className="text-lab-pequeno font-medium text-lab-destaque-texto hover:underline"
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
  const notificar = useNotificar();
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
    decidir.mutate(
      { id: contestacao.id, decisao, nota: nota.trim() },
      {
        onSuccess: () => {
          notificar({
            tom: "sucesso",
            titulo: decisao === "aceita" ? "Contestação aceita" : "Contestação rejeitada"
          });
          aoFechar();
        }
      }
    );
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <div className="text-lab-pequeno">
        <p className="font-medium text-lab-tinta">{contestacao.ponto}</p>
        <p className="mt-1 leading-6 text-lab-tinta-2">{contestacao.motivo}</p>
      </div>
      <p
        role="note"
        className="rounded-lab-md bg-lab-superficie-2 p-3 text-lab-pequeno leading-6 text-lab-tinta-2"
      >
        {jaValidado
          ? "Este resultado já foi validado, e uma validação não se refaz: a decisão fica registrada, mas o resultado não muda."
          : "Aceitar registra a decisão e a nota. Se o nível de alguma skill deve mudar, faça o ajuste ao validar o resultado."}
      </p>
      <fieldset className="space-y-2">
        <legend className="text-lab-pequeno font-medium text-lab-tinta-2">Decisão</legend>
        {(
          [
            ["aceita", "Aceitar a contestação"],
            ["rejeitada", "Rejeitar a contestação"]
          ] as const
        ).map(([valor, rotulo]) => (
          <label key={valor} className="flex items-center gap-2 text-lab-pequeno text-lab-tinta">
            <Marcacao
              type="radio"
              name="decisao-da-contestacao"
              checked={decisao === valor}
              onChange={() => setDecisao(valor)}
            />
            {rotulo}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2 text-lab-pequeno font-medium text-lab-tinta-2">
        <label htmlFor="nota-da-contestacao">Nota para o participante</label>
        <Textarea
          id="nota-da-contestacao"
          rows={4}
          maxLength={labLimitesDeTexto.nota}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <span className="text-lab-legenda font-normal text-lab-tinta-2">
          {nota.length}/{labLimitesDeTexto.nota}
        </span>
      </div>
      {aviso ? <MensagemDeErro>{aviso}</MensagemDeErro> : null}
      {decidir.isError ? (
        <MensagemDeErro>
          {descreverErroDoCadastro(decidir.error, "acompanhamento").descricao}
        </MensagemDeErro>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={aoFechar} disabled={decidir.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={decidir.isPending}>
          {decidir.isPending ? "Registrando..." : "Registrar decisão"}
        </Button>
      </div>
    </form>
  );
}
