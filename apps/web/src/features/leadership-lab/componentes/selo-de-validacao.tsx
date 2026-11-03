import type { LabStatusValidacao } from "@my-flux/shared";
import { Badge } from "../../../components/ui";
import { nomeDoStatusDeValidacao } from "../rotulos";

/** "Aguardando validação" enquanto o curador do RH não revisou; depois, "Validado". */
export function SeloDeValidacao({ status }: { status: LabStatusValidacao }) {
  return (
    <Badge tone={status === "aguardando_validacao" ? "warning" : "success"}>
      {nomeDoStatusDeValidacao[status]}
    </Badge>
  );
}
