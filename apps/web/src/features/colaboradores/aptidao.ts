// Como a tela mostra a aptidão que a API calcula (GET /employees/:id/aptitude). A cor nunca vem
// sozinha: cada estado tem ícone e palavra próprios, e o motivo vai na dica. Quem calcula é o
// servidor (aptitude-service.ts); aqui só se traduz o resultado para a pessoa ler.
export type CorDaAptidao = "GREEN" | "YELLOW" | "RED";

export type Aptidao = {
  employeeId?: string;
  status: CorDaAptidao;
  reasons: { code: string; message: string; severity: CorDaAptidao }[];
};

export const rotuloDaAptidao: Record<CorDaAptidao, string> = {
  GREEN: "Apto",
  YELLOW: "Atenção",
  RED: "Inapto"
};

/** A resposta tem a forma esperada? Qualquer outra coisa é tratada como "sem informação". */
export function ehAptidao(valor: unknown): valor is Aptidao {
  if (!valor || typeof valor !== "object") return false;
  const { status, reasons } = valor as Partial<Aptidao>;
  return (status === "GREEN" || status === "YELLOW" || status === "RED") && Array.isArray(reasons);
}

/**
 * O texto da dica: os motivos que puxaram a cor para baixo, os mais graves primeiro. Quando está
 * tudo em dia, a única mensagem verde do servidor explica isso.
 */
export function motivosDaAptidao(aptidao: Aptidao): string {
  const peso: Record<CorDaAptidao, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
  const relevantes =
    aptidao.status === "GREEN"
      ? aptidao.reasons
      : aptidao.reasons.filter((motivo) => motivo.severity !== "GREEN");
  const mensagens = [...relevantes]
    .sort((a, b) => peso[a.severity] - peso[b.severity])
    .map((motivo) => motivo.message.trim())
    .filter(Boolean);
  return mensagens.length ? mensagens.join(" · ") : rotuloDaAptidao[aptidao.status];
}
