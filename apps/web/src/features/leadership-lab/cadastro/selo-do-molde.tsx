import type { LabMoldeDoCadastro } from "@my-flux/shared";
import { Badge } from "../ui";

/**
 * O teste do cargo do colaborador: sem molde (o cargo não está em nenhum), com molde ainda não
 * liberado (falta o tempo ou a liberação) ou liberado (o participante consegue iniciar).
 */
export function SeloDoMolde({ molde }: { molde: LabMoldeDoCadastro | null }) {
  if (molde === null) return <Badge tone="warning">Sem teste para o cargo</Badge>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-lab-tinta-2">{molde.nome}</span>
      <Badge tone={molde.liberado ? "success" : "neutral"}>
        {molde.liberado ? "Liberado" : "Não liberado"}
      </Badge>
    </span>
  );
}
