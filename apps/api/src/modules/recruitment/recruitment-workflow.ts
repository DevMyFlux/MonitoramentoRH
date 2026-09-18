import { HttpError } from "../../lib/http-error.js";
export const stages = [
  "REQUESTED",
  "RECRUITING",
  "SELECTED",
  "DOCUMENTATION",
  "MEDICAL_EXAM",
  "ADMISSION_SCHEDULED",
  "ADMITTED"
] as const;
export function assertAdmissionTransition(
  from: string,
  to: string,
  documents: boolean,
  medical: boolean,
  date: Date | null,
  now = new Date()
) {
  if (["ADMITTED", "WITHDRAWN", "CANCELLED"].includes(from))
    throw new HttpError(409, "ADMISSION_TERMINAL", "Processo encerrado.");
  if (["WITHDRAWN", "CANCELLED"].includes(to)) return;
  const index = stages.findIndex((stage) => stage === from);
  if (index < 0 || stages[index + 1] !== to)
    throw new HttpError(409, "INVALID_TRANSITION", "Etapas devem seguir a sequência do processo.");
  if (to === "MEDICAL_EXAM" && !documents)
    throw new HttpError(409, "DOCUMENTATION_PENDING", "Conclua a conferência documental.");
  if (to === "ADMISSION_SCHEDULED" && (!documents || !medical || !date))
    throw new HttpError(
      409,
      "ADMISSION_CHECKLIST_PENDING",
      "Documentos, exame e data de admissão são obrigatórios."
    );
  if (to === "ADMITTED" && (!date || date > now || !documents || !medical))
    throw new HttpError(
      409,
      "FUTURE_ADMISSION",
      "Admissão exige data efetiva atingida e checklist concluído."
    );
}
