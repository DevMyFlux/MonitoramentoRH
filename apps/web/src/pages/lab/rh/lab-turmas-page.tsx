import { labCriarTurmaEntradaSchema, labNomeDaTurmaLimites } from "@my-flux/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  classeDaSuperficie,
  EmptyState,
  Input,
  LoadingState,
  MensagemDeErro,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "../../../features/leadership-lab/ui";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import { useCriarTurma, useTurmas } from "../../../features/leadership-lab/cadastro-hooks";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import { formatarDataCurta } from "../../../features/leadership-lab/rotulos";
import { cn } from "../../../lib/cn";

export function LabTurmasPage() {
  const turmas = useTurmas();

  return (
    <LayoutDoAcompanhamento>
      <NovaTurma />
      {turmas.isPending ? (
        <LoadingState />
      ) : turmas.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(turmas.error, "acompanhamento")}
          aoTentarDeNovo={() => void turmas.refetch()}
        />
      ) : turmas.data.length === 0 ? (
        <EmptyState
          title="Você ainda não tem turmas"
          description="A turma define de quem você vê os resultados. Crie uma e inclua os participantes que você acompanha."
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Turma</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
              <TableHeaderCell>Participantes</TableHeaderCell>
              <TableHeaderCell>Criada em</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {turmas.data.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    to={`/lab/rh/turmas/${t.id}`}
                    className="font-medium text-lab-destaque-texto underline-offset-2 hover:underline"
                  >
                    {t.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge tone={t.ativa ? "success" : "neutral"}>
                    {t.ativa ? "Ativa" : "Encerrada"}
                  </Badge>
                </TableCell>
                <TableCell>{t.nParticipantes}</TableCell>
                <TableCell className="tabular whitespace-nowrap">
                  {formatarDataCurta(t.criadaEm)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </LayoutDoAcompanhamento>
  );
}

function NovaTurma() {
  const navegar = useNavigate();
  const criar = useCriarTurma();
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const enviar = () => {
    const lido = labCriarTurmaEntradaSchema.safeParse({ nome });
    if (!lido.success) {
      setAviso(
        `O nome da turma deve ter de ${labNomeDaTurmaLimites.min} a ${labNomeDaTurmaLimites.max} letras.`
      );
      return;
    }
    setAviso(null);
    criar.mutate(lido.data, { onSuccess: (turma) => navegar(`/lab/rh/turmas/${turma.id}`) });
  };

  return (
    <form
      className={cn(classeDaSuperficie, "flex flex-wrap items-end gap-3 p-4")}
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <div className="min-w-0 flex-1 basis-64">
        <Input
          label="Nova turma"
          placeholder="Ex.: Supervisores — 1º semestre"
          value={nome}
          maxLength={labNomeDaTurmaLimites.max}
          onChange={(e) => setNome(e.target.value)}
          error={aviso ?? undefined}
        />
      </div>
      <Button type="submit" icon={<Plus size={16} aria-hidden="true" />} loading={criar.isPending}>
        {criar.isPending ? "Criando..." : "Criar turma"}
      </Button>
      {criar.isError ? (
        <MensagemDeErro variante="texto" className="basis-full">
          {descreverErroDoCadastro(criar.error, "acompanhamento").descricao}
        </MensagemDeErro>
      ) : null}
    </form>
  );
}
