// Cadastro de uma conta de acesso: além de e-mail, nome e perfil, toda conta tem CARGO, NÍVEL DE
// GOVERNANÇA e ÁREA. Eles definem o público dos treinamentos e dão contexto à IA (cargo, nível e
// área da pessoa). São obrigatórios em contas NOVAS e ao EDITAR contas antigas; no banco ficam
// opcionais só para não quebrar quem já existia (o selo "Cadastro incompleto" mostra o que falta).
//
// A lista de níveis é repetida em packages/validation (zod), que não depende deste pacote; um teste
// da API garante que as duas listas são iguais.

export const niveisDeGovernanca = ["assistente", "supervisor", "coordenador", "diretoria"] as const;
export type NivelDeGovernanca = (typeof niveisDeGovernanca)[number];

export const rotuloDoNivel: Readonly<Record<NivelDeGovernanca, string>> = {
  assistente: "Assistente",
  supervisor: "Supervisor",
  coordenador: "Coordenador",
  diretoria: "Diretoria"
};

export const camposDoCadastro = ["cargo", "nivelGovernanca", "areaId"] as const;
export type CampoDoCadastro = (typeof camposDoCadastro)[number];

export const rotuloDoCampoDoCadastro: Readonly<Record<CampoDoCadastro, string>> = {
  cargo: "Cargo",
  nivelGovernanca: "Nível de governança",
  areaId: "Área"
};

export type CadastroDaConta = {
  cargo?: string | null | undefined;
  nivelGovernanca?: string | null | undefined;
  areaId?: string | null | undefined;
};

/** Os campos do cadastro que faltam (em branco ou só espaços contam como faltando). */
export function camposFaltando(conta: CadastroDaConta): CampoDoCadastro[] {
  const faltando: CampoDoCadastro[] = [];
  if (!conta.cargo || conta.cargo.trim().length === 0) faltando.push("cargo");
  if (!conta.nivelGovernanca) faltando.push("nivelGovernanca");
  if (!conta.areaId) faltando.push("areaId");
  return faltando;
}

export function cadastroIncompleto(conta: CadastroDaConta): boolean {
  return camposFaltando(conta).length > 0;
}

/** "Cargo, Área": o que falta, em português, para o selo e a dica. */
export function textoDoQueFalta(conta: CadastroDaConta): string {
  return camposFaltando(conta)
    .map((campo) => rotuloDoCampoDoCadastro[campo])
    .join(", ");
}
