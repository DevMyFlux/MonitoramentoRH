import type { LabParticipanteDoCadastro } from "@my-flux/shared";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  MensagemDeErro,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  useNotificar
} from "../../../features/leadership-lab/ui";
import { CadastrarParticipante } from "../../../features/leadership-lab/cadastro/cadastrar-participante";
import { Confirmacao } from "../../../features/leadership-lab/cadastro/confirmacao";
import { LayoutDoAcompanhamento } from "../../../features/leadership-lab/cadastro/layout-do-acompanhamento";
import { SeloDoMolde } from "../../../features/leadership-lab/cadastro/selo-do-molde";
import {
  useAtualizarParticipante,
  useParticipantes
} from "../../../features/leadership-lab/cadastro-hooks";
import { ErroDaTelaDoLab } from "../../../features/leadership-lab/componentes/erro-da-tela";
import { descreverErroDoCadastro } from "../../../features/leadership-lab/erros";

export function LabParticipantesPage() {
  const participantes = useParticipantes();
  const [cadastrando, setCadastrando] = useState(false);

  return (
    <LayoutDoAcompanhamento>
      {participantes.isPending ? (
        <LoadingState />
      ) : participantes.isError ? (
        <ErroDaTelaDoLab
          erro={descreverErroDoCadastro(participantes.error, "acompanhamento")}
          aoTentarDeNovo={() => void participantes.refetch()}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-lab-pequeno text-lab-tinta-2">
              Participante é o colaborador ligado a um usuário de perfil comum. Só ele faz os
              testes. Desativar tira o acesso e guarda o histórico.
            </p>
            <Button
              icon={<UserPlus size={16} aria-hidden="true" />}
              onClick={() => setCadastrando(true)}
            >
              Cadastrar participante
            </Button>
          </div>
          {participantes.data.length === 0 ? (
            <EmptyState
              title="Nenhum participante ainda"
              description="Cadastre o primeiro: escolha o colaborador e o usuário dele. Depois monte uma turma para acompanhar os resultados."
            />
          ) : (
            <TabelaDeParticipantes participantes={participantes.data} />
          )}
        </>
      )}
      <CadastrarParticipante aberto={cadastrando} aoFechar={() => setCadastrando(false)} />
    </LayoutDoAcompanhamento>
  );
}

function TabelaDeParticipantes({ participantes }: { participantes: LabParticipanteDoCadastro[] }) {
  const atualizar = useAtualizarParticipante();
  const notificar = useNotificar();
  const [aDesativar, setADesativar] = useState<LabParticipanteDoCadastro | null>(null);

  const fechar = () => {
    setADesativar(null);
    atualizar.reset();
  };

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Colaborador</TableHeaderCell>
            <TableHeaderCell>Cargo</TableHeaderCell>
            <TableHeaderCell>Operação</TableHeaderCell>
            <TableHeaderCell>Teste do cargo</TableHeaderCell>
            <TableHeaderCell>Usuário</TableHeaderCell>
            <TableHeaderCell>Situação</TableHeaderCell>
            <TableHeaderCell aria-label="Ações" />
          </TableRow>
        </TableHead>
        <TableBody>
          {participantes.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <span className="block font-medium text-lab-tinta">{p.colaborador.nome}</span>
                <span className="block text-lab-legenda text-lab-tinta-2">
                  Matrícula {p.colaborador.identificador}
                </span>
              </TableCell>
              <TableCell>{p.colaborador.cargo ?? "—"}</TableCell>
              <TableCell>{p.colaborador.operacao}</TableCell>
              <TableCell>
                <SeloDoMolde molde={p.colaborador.molde} />
              </TableCell>
              <TableCell>
                <span className="block">{p.usuario.nome}</span>
                <span className="block text-lab-legenda text-lab-tinta-2">{p.usuario.email}</span>
              </TableCell>
              <TableCell>
                <Badge tone={p.ativo ? "success" : "neutral"}>
                  {p.ativo ? "Ativo" : "Desativado"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {p.ativo ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Desativar ${p.colaborador.nome}`}
                    onClick={() => setADesativar(p)}
                  >
                    Desativar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Reativar ${p.colaborador.nome}`}
                    disabled={atualizar.isPending}
                    onClick={() =>
                      atualizar.mutate(
                        { id: p.id, ativo: true },
                        {
                          onSuccess: () =>
                            notificar({
                              tom: "sucesso",
                              titulo: "Participante reativado",
                              descricao: `${p.colaborador.nome} voltou a ter acesso ao Leadership Lab.`
                            })
                        }
                      )
                    }
                  >
                    Reativar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {atualizar.isError && aDesativar === null ? (
        <MensagemDeErro variante="texto">
          {descreverErroDoCadastro(atualizar.error, "acompanhamento").descricao}
        </MensagemDeErro>
      ) : null}
      <Confirmacao
        aberta={aDesativar !== null}
        titulo={`Desativar ${aDesativar?.colaborador.nome ?? ""}?`}
        descricao="Ele perde o acesso ao Leadership Lab. O histórico dos testes fica guardado e você pode reativá-lo quando quiser."
        confirmar="Desativar participante"
        perigosa
        pendente={atualizar.isPending}
        erro={
          atualizar.isError
            ? descreverErroDoCadastro(atualizar.error, "acompanhamento").descricao
            : null
        }
        aoCancelar={fechar}
        aoConfirmar={() => {
          if (aDesativar)
            atualizar.mutate(
              { id: aDesativar.id, ativo: false },
              {
                onSuccess: () => {
                  notificar({ tom: "sucesso", titulo: "Participante desativado" });
                  fechar();
                }
              }
            );
        }}
      />
    </>
  );
}
