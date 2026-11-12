import { type LabAlertaDoCurador, labLimitesDeTexto } from "@my-flux/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Textarea,
  useNotificar
} from "../../../features/leadership-lab/ui";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import {
  IdentificacaoDoParticipante,
  SeloDeAlerta
} from "../../../features/leadership-lab/cadastro/situacao-de-curadoria";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { useAlertas, useTratarAlerta } from "../../../features/leadership-lab/curadoria-hooks";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";
import { formatarDataEHora } from "../../../features/leadership-lab/rotulos";

const filtros = [
  { value: "aberto", label: "Abertos" },
  { value: "encerrado", label: "Encerrados" },
  { value: "todos", label: "Todos" }
];

export function LabAlertasPage() {
  const [status, setStatus] = useState("aberto");
  const alertas = useAlertas(status);
  const [aEncerrar, setAEncerrar] = useState<LabAlertaDoCurador | null>(null);

  return (
    <LayoutDoAcompanhamento>
      <p className="max-w-3xl text-lab-pequeno text-lab-tinta-2">
        Alertas são pedagógicos, não disciplinares: servem para o RH conversar com o participante. O
        vermelho nasce na hora, quando uma escolha é avaliada como muito distante do estilo
        adequado, e por isso aparece mesmo com o teste em andamento. O amarelo aparece quando a
        mesma skill fica abaixo de 50 em dois testes seguidos.
      </p>
      <div className="max-w-xs">
        <Select
          label="Mostrar"
          name="filtro-dos-alertas"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={filtros}
        />
      </div>
      {alertas.isPending ? (
        <LoadingState />
      ) : alertas.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(alertas.error, "acompanhamento")}
          aoTentarDeNovo={() => void alertas.refetch()}
        />
      ) : alertas.data.length === 0 ? (
        <EmptyState
          title={status === "aberto" ? "Nenhum alerta aberto" : "Nenhum alerta por aqui"}
          description="Os alertas dos participantes das suas turmas aparecem aqui."
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Alerta</TableHeaderCell>
              <TableHeaderCell>Participante</TableHeaderCell>
              <TableHeaderCell>Em</TableHeaderCell>
              <TableHeaderCell>Teste</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
              <TableHeaderCell aria-label="Ações" />
            </TableRow>
          </TableHead>
          <TableBody>
            {alertas.data.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <SeloDeAlerta cor={a.cor} />
                  <span className="mt-1 block text-lab-tinta">
                    {a.skillNome ?? (a.situacao ? `Situação ${a.situacao}` : "—")}
                  </span>
                </TableCell>
                <TableCell>
                  <IdentificacaoDoParticipante {...a.participante} />
                </TableCell>
                <TableCell className="tabular whitespace-nowrap">
                  {formatarDataEHora(a.criadoEm)}
                </TableCell>
                <TableCell>
                  {a.testeConcluido && a.resultadoId ? (
                    <Link
                      to={`/lab/rh/revisao/${a.resultadoId}`}
                      className="font-medium text-lab-destaque-texto hover:underline"
                    >
                      Abrir resultado
                    </Link>
                  ) : (
                    <Badge tone="info">Em andamento</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={a.status === "aberto" ? "warning" : "neutral"}>
                    {a.status === "aberto" ? "Aberto" : "Encerrado"}
                  </Badge>
                  {a.status === "encerrado" ? (
                    <span className="mt-1 block text-lab-legenda text-lab-tinta-2">
                      {a.tratadoPor ? `${a.tratadoPor}` : ""}
                      {a.tratadoEm ? ` em ${formatarDataEHora(a.tratadoEm)}` : ""}
                      {a.nota ? `: ${a.nota}` : ""}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  {a.status === "aberto" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Encerrar o alerta de ${a.participante.nome}`}
                      onClick={() => setAEncerrar(a)}
                    >
                      Encerrar
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <EncerrarAlerta alerta={aEncerrar} aoFechar={() => setAEncerrar(null)} />
    </LayoutDoAcompanhamento>
  );
}

function EncerrarAlerta({
  alerta,
  aoFechar
}: {
  alerta: LabAlertaDoCurador | null;
  aoFechar: () => void;
}) {
  return (
    <Modal
      isOpen={alerta !== null}
      title="Encerrar alerta"
      description="Registre a conversa de desenvolvimento que você teve com o participante. Encerrar não se desfaz."
      onClose={aoFechar}
    >
      {/* O conteúdo só existe com o modal aberto: abrir de novo começa do zero. */}
      {alerta ? <FormularioDaNota alerta={alerta} aoFechar={aoFechar} /> : null}
    </Modal>
  );
}

function FormularioDaNota({
  alerta,
  aoFechar
}: {
  alerta: LabAlertaDoCurador;
  aoFechar: () => void;
}) {
  const tratar = useTratarAlerta();
  const notificar = useNotificar();
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const enviar = () => {
    if (nota.trim() === "") {
      setAviso("Escreva a nota da conversa: sem ela o alerta não pode ser encerrado.");
      return;
    }
    setAviso(null);
    tratar.mutate(
      { id: alerta.id, nota: nota.trim() },
      {
        onSuccess: () => {
          notificar({
            tom: "sucesso",
            titulo: "Alerta encerrado",
            descricao: "A nota da conversa foi registrada."
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
      <p className="text-lab-pequeno text-lab-tinta-2">
        {alerta.participante.nome} · {alerta.skillNome ?? `Situação ${alerta.situacao}`}
      </p>
      <div className="grid gap-2 text-lab-pequeno font-medium text-lab-tinta-2">
        <label htmlFor="nota-do-alerta">Nota da conversa</label>
        <Textarea
          id="nota-do-alerta"
          rows={4}
          maxLength={labLimitesDeTexto.nota}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <span className="text-lab-legenda font-normal text-lab-tinta-2">
          {nota.length}/{labLimitesDeTexto.nota}
        </span>
      </div>
      {aviso ? (
        <p
          role="alert"
          className="rounded-lab-md bg-lab-perigo-suave p-3 text-lab-pequeno text-lab-perigo-texto"
        >
          {aviso}
        </p>
      ) : null}
      {tratar.isError ? (
        <p
          role="alert"
          className="rounded-lab-md bg-lab-perigo-suave p-3 text-lab-pequeno text-lab-perigo-texto"
        >
          {descreverErroDoCadastro(tratar.error, "acompanhamento").descricao}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={aoFechar} disabled={tratar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={tratar.isPending}>
          {tratar.isPending ? "Encerrando..." : "Encerrar alerta"}
        </Button>
      </div>
    </form>
  );
}
