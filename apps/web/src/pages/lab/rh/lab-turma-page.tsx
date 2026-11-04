import {
  type LabParticipanteDoCadastro,
  type LabTurmaDetalhe,
  labAtualizarTurmaEntradaSchema,
  labNomeDaTurmaLimites
} from "@my-flux/shared";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  LoadingState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "../../../components/ui";
import { Confirmacao } from "../../../features/leadership-lab/cadastro/confirmacao";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import { SeloDoMolde } from "../../../features/leadership-lab/cadastro/selo-do-molde";
import {
  useAtualizarTurma,
  useIncluirNaTurma,
  useParticipantes,
  useRemoverDaTurma,
  useTurma
} from "../../../features/leadership-lab/cadastro-hooks";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";

export function LabTurmaPage() {
  const { id = "" } = useParams();
  const turma = useTurma(id);

  const voltar = (
    <Link
      to="/lab/rh/turmas"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Voltar às turmas
    </Link>
  );

  return (
    <LayoutDoAcompanhamento>
      {voltar}
      {turma.isPending ? (
        <LoadingState />
      ) : turma.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(turma.error, "acompanhamento")}
          aoTentarDeNovo={() => void turma.refetch()}
        />
      ) : (
        <Detalhe turma={turma.data} />
      )}
    </LayoutDoAcompanhamento>
  );
}

function Detalhe({ turma }: { turma: LabTurmaDetalhe }) {
  return (
    <div className="space-y-6">
      <Cabecalho turma={turma} />
      <Participantes turma={turma} />
    </div>
  );
}

function Cabecalho({ turma }: { turma: LabTurmaDetalhe }) {
  const atualizar = useAtualizarTurma(turma.id);
  const [nome, setNome] = useState(turma.nome);
  const [aviso, setAviso] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  const salvarNome = () => {
    const lido = labAtualizarTurmaEntradaSchema.safeParse({ nome });
    if (!lido.success) {
      setAviso(
        `O nome da turma deve ter de ${labNomeDaTurmaLimites.min} a ${labNomeDaTurmaLimites.max} letras.`
      );
      return;
    }
    setAviso(null);
    atualizar.mutate(lido.data);
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{turma.nome}</h2>
        <Badge tone={turma.ativa ? "success" : "neutral"}>
          {turma.ativa ? "Ativa" : "Encerrada"}
        </Badge>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          salvarNome();
        }}
      >
        <div className="min-w-0 flex-1 basis-64">
          <Input
            label="Nome da turma"
            value={nome}
            maxLength={labNomeDaTurmaLimites.max}
            onChange={(e) => setNome(e.target.value)}
            error={aviso ?? undefined}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={atualizar.isPending || nome.trim() === turma.nome}
        >
          Salvar nome
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="max-w-xl text-sm text-slate-600">
          {turma.ativa
            ? "Você vê os resultados dos participantes das turmas ativas. Encerrar a turma tira esses resultados da sua vista, sem apagar nada."
            : "Turma encerrada: os resultados dos participantes dela não aparecem para você. Reabra para voltar a acompanhá-los."}
        </p>
        {turma.ativa ? (
          <Button variant="danger" onClick={() => setEncerrando(true)}>
            Encerrar turma
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={atualizar.isPending}
            onClick={() => atualizar.mutate({ ativa: true })}
          >
            Reabrir turma
          </Button>
        )}
      </div>

      {atualizar.isError && !encerrando ? (
        <p role="alert" className="text-sm text-red-700">
          {descreverErroDoCadastro(atualizar.error, "acompanhamento").descricao}
        </p>
      ) : null}

      <Confirmacao
        aberta={encerrando}
        titulo={`Encerrar a turma ${turma.nome}?`}
        descricao="Você deixa de ver os resultados dos participantes desta turma, inclusive os que aguardam validação (a não ser que estejam em outra turma ativa sua). Nada é apagado e você pode reabri-la."
        confirmar="Encerrar turma"
        perigosa
        pendente={atualizar.isPending}
        erro={
          atualizar.isError
            ? descreverErroDoCadastro(atualizar.error, "acompanhamento").descricao
            : null
        }
        aoCancelar={() => {
          setEncerrando(false);
          atualizar.reset();
        }}
        aoConfirmar={() =>
          atualizar.mutate({ ativa: false }, { onSuccess: () => setEncerrando(false) })
        }
      />
    </section>
  );
}

function Participantes({ turma }: { turma: LabTurmaDetalhe }) {
  const remover = useRemoverDaTurma(turma.id);
  const [aRemover, setARemover] = useState<LabParticipanteDoCadastro | null>(null);

  const fechar = () => {
    setARemover(null);
    remover.reset();
  };

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-slate-950">
        Participantes ({turma.nParticipantes})
      </h2>

      <IncluirParticipante turma={turma} />

      {turma.participantes.length === 0 ? (
        <EmptyState
          title="A turma está vazia"
          description="Inclua participantes para acompanhar os resultados deles."
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Colaborador</TableHeaderCell>
              <TableHeaderCell>Cargo</TableHeaderCell>
              <TableHeaderCell>Teste do cargo</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
              <TableHeaderCell aria-label="Ações" />
            </TableRow>
          </TableHead>
          <TableBody>
            {turma.participantes.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="block font-medium text-slate-900">{p.colaborador.nome}</span>
                  <span className="block text-xs text-slate-500">
                    Matrícula {p.colaborador.identificador}
                  </span>
                </TableCell>
                <TableCell>{p.colaborador.cargo ?? "—"}</TableCell>
                <TableCell>
                  <SeloDoMolde molde={p.colaborador.molde} />
                </TableCell>
                <TableCell>
                  <Badge tone={p.ativo ? "success" : "neutral"}>
                    {p.ativo ? "Ativo" : "Desativado"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Tirar ${p.colaborador.nome} da turma`}
                    onClick={() => setARemover(p)}
                  >
                    Tirar da turma
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Confirmacao
        aberta={aRemover !== null}
        titulo={`Tirar ${aRemover?.colaborador.nome ?? ""} da turma?`}
        descricao="Você deixa de ver os resultados dele, inclusive os que aguardam validação. Ele continua cadastrado como participante e pode voltar à turma."
        confirmar="Tirar da turma"
        perigosa
        pendente={remover.isPending}
        erro={
          remover.isError
            ? descreverErroDoCadastro(remover.error, "acompanhamento").descricao
            : null
        }
        aoCancelar={fechar}
        aoConfirmar={() => {
          if (aRemover) remover.mutate(aRemover.id, { onSuccess: fechar });
        }}
      />
    </section>
  );
}

function IncluirParticipante({ turma }: { turma: LabTurmaDetalhe }) {
  const participantes = useParticipantes();
  const incluir = useIncluirNaTurma(turma.id);
  const [escolhido, setEscolhido] = useState("");

  const naTurma = new Set(turma.participantes.map((p) => p.id));
  const candidatos = (participantes.data ?? []).filter((p) => p.ativo && !naTurma.has(p.id));

  if (!turma.ativa) {
    return (
      <p className="text-sm text-slate-600">Reabra a turma para incluir participantes nela.</p>
    );
  }
  if (participantes.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {descreverErroDoCadastro(participantes.error, "acompanhamento").descricao}
      </p>
    );
  }
  if (participantes.isSuccess && candidatos.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        {participantes.data.some((p) => p.ativo) ? (
          "Todos os participantes ativos já estão nesta turma."
        ) : (
          <>
            Não há participantes ativos para incluir.{" "}
            <Link
              to="/lab/rh/participantes"
              className="font-medium text-emerald-800 hover:underline"
            >
              Cadastre participantes
            </Link>{" "}
            primeiro.
          </>
        )}
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (escolhido) incluir.mutate(escolhido, { onSuccess: () => setEscolhido("") });
      }}
    >
      <div className="min-w-0 flex-1 basis-64">
        <Select
          label="Incluir participante"
          name="incluir-participante"
          value={escolhido}
          disabled={participantes.isPending}
          onChange={(e) => setEscolhido(e.target.value)}
          options={[
            {
              value: "",
              label: participantes.isPending ? "Carregando..." : "Escolha um participante"
            },
            ...candidatos.map((p) => ({
              value: p.id,
              label: `${p.colaborador.nome} — matrícula ${p.colaborador.identificador}`
            }))
          ]}
        />
      </div>
      <Button type="submit" disabled={!escolhido || incluir.isPending}>
        {incluir.isPending ? "Incluindo..." : "Incluir na turma"}
      </Button>
      {incluir.isError ? (
        <p role="alert" className="basis-full text-sm text-red-700">
          {descreverErroDoCadastro(incluir.error, "acompanhamento").descricao}
        </p>
      ) : null}
    </form>
  );
}
