import type { LabAlertaCor, LabContestacaoStatus, LabContribuicaoStatus } from "@my-flux/shared";
import { Badge } from "../../../components/ui";

const tomDoStatus = {
  pendente: "warning",
  aceita: "success",
  aprovada: "success",
  rejeitada: "neutral"
} as const;

const rotuloDoStatus = {
  pendente: "Pendente",
  aceita: "Aceita",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada"
} as const;

/** O estado de uma contestação ou de uma contribuição. */
export function SeloDeDecisao({
  status
}: {
  status: LabContestacaoStatus | LabContribuicaoStatus;
}) {
  return <Badge tone={tomDoStatus[status]}>{rotuloDoStatus[status]}</Badge>;
}

/** Vermelho é o que pede atenção; amarelo, o que merece acompanhamento. */
export function SeloDeAlerta({ cor }: { cor: LabAlertaCor }) {
  return (
    <Badge tone={cor === "vermelho" ? "danger" : "warning"}>
      {cor === "vermelho" ? "Vermelho" : "Amarelo"}
    </Badge>
  );
}

/** "Fulana · MAT-1 · Supervisor · Operação A", na ordem em que o curador a reconhece. */
export function IdentificacaoDoParticipante({
  nome,
  identificador,
  cargo,
  operacao
}: {
  nome: string;
  identificador: string;
  cargo: string | null;
  operacao: string;
}) {
  return (
    <>
      <span className="block font-medium text-slate-900">{nome}</span>
      <span className="block text-xs text-slate-500">
        Matrícula {identificador} · {cargo ?? "Sem cargo"} · {operacao}
      </span>
    </>
  );
}
