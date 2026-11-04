import type { LabItemDaRevisao } from "@my-flux/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  EmptyState,
  LoadingState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "../../../components/ui";
import { IdentificacaoDoParticipante } from "../../../features/leadership-lab/cadastro/situacao-de-curadoria";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { SeloDeValidacao } from "../../../features/leadership-lab/componentes/selo-de-validacao";
import { useRevisao } from "../../../features/leadership-lab/curadoria-hooks";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import { formatarDataEHora, formatarNumero } from "../../../features/leadership-lab/rotulos";

const filtros = [
  { value: "aguardando_validacao", label: "Aguardando validação" },
  { value: "validado", label: "Validados" },
  { value: "ajustado", label: "Validados com ajuste" },
  { value: "todos", label: "Todos" }
];

const textoVazio: Record<string, { titulo: string; descricao: string }> = {
  aguardando_validacao: {
    titulo: "Nada aguardando validação",
    descricao:
      "Os resultados dos participantes das suas turmas aparecem aqui quando o teste termina. Se esperava algum, confira se o participante está numa turma ativa sua."
  },
  validado: {
    titulo: "Nenhum resultado validado ainda",
    descricao: "Os que você validar sem ajuste ficam aqui."
  },
  ajustado: {
    titulo: "Nenhum resultado ajustado ainda",
    descricao: "Os que você validar com ajuste de nível ficam aqui."
  },
  todos: {
    titulo: "Nenhum resultado ainda",
    descricao: "Quando um participante das suas turmas concluir um teste, o resultado aparece aqui."
  }
};

export function LabRevisaoPage() {
  const [status, setStatus] = useState("aguardando_validacao");
  const revisao = useRevisao(status);

  return (
    <LayoutDoAcompanhamento>
      <div className="max-w-xs">
        <Select
          label="Mostrar"
          name="filtro-da-revisao"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={filtros}
        />
      </div>
      {revisao.isPending ? (
        <LoadingState />
      ) : revisao.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(revisao.error, "acompanhamento")}
          aoTentarDeNovo={() => void revisao.refetch()}
        />
      ) : revisao.data.length === 0 ? (
        <EmptyState
          title={textoVazio[status]?.titulo ?? "Nada por aqui"}
          description={textoVazio[status]?.descricao ?? ""}
        />
      ) : (
        <TabelaDaRevisao itens={revisao.data} />
      )}
    </LayoutDoAcompanhamento>
  );
}

function TabelaDaRevisao({ itens }: { itens: LabItemDaRevisao[] }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Participante</TableHeaderCell>
          <TableHeaderCell>Teste</TableHeaderCell>
          <TableHeaderCell>Concluído em</TableHeaderCell>
          <TableHeaderCell>Aderência</TableHeaderCell>
          <TableHeaderCell>Agilidade</TableHeaderCell>
          <TableHeaderCell>Pendências</TableHeaderCell>
          <TableHeaderCell>Situação</TableHeaderCell>
          <TableHeaderCell aria-label="Ações" />
        </TableRow>
      </TableHead>
      <TableBody>
        {itens.map((item) => (
          <TableRow key={item.resultadoId}>
            <TableCell>
              <IdentificacaoDoParticipante {...item.participante} />
            </TableCell>
            <TableCell>{item.moldeNome}</TableCell>
            <TableCell>{formatarDataEHora(item.concluidaEm)}</TableCell>
            <TableCell>{formatarNumero(item.aderenciaGeral)}%</TableCell>
            <TableCell>{formatarNumero(item.agilidade)}%</TableCell>
            <TableCell>
              <span className="flex flex-wrap gap-1">
                {item.alertasAbertos > 0 ? (
                  <Badge tone="danger">
                    {item.alertasAbertos} {item.alertasAbertos === 1 ? "alerta" : "alertas"}
                  </Badge>
                ) : null}
                {item.contestacoesPendentes > 0 ? (
                  <Badge tone="warning">
                    {item.contestacoesPendentes}{" "}
                    {item.contestacoesPendentes === 1 ? "contestação" : "contestações"}
                  </Badge>
                ) : null}
                {item.alertasAbertos === 0 && item.contestacoesPendentes === 0 ? "—" : null}
              </span>
            </TableCell>
            <TableCell>
              <SeloDeValidacao status={item.statusValidacao} />
            </TableCell>
            <TableCell className="text-right">
              <Link
                to={`/lab/rh/revisao/${item.resultadoId}`}
                aria-label={`Revisar o resultado de ${item.participante.nome}`}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {item.statusValidacao === "aguardando_validacao" ? "Revisar" : "Abrir"}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
