// Treinamentos Interativos — quem faz o quê. Mesmas regras do Leadership Lab:
//  - participante: COMUM (e DEV) vinculado a um colaborador no Lab (leadership_lab.participante);
//  - curador: RH (e DEV), só nas turmas ATIVAS que acompanha (DEV vê todas);
//  - administrador: ADMIN e DEV (cadastrar, validar, aprovar e atribuir cenários).
// O DEV acumula os três papéis. Registro de outra pessoa ou de fora da turma responde 404, igual a
// "não existe", para não revelar que ele existe. Esconder botão na tela é só arrumação: quem decide
// é a API, com estas funções.
/** Os perfis do sistema (o mesmo Role de @my-flux/types; repetido para shared não depender dele). */
export type TreinoPerfil = "DEV" | "ADMIN" | "RH" | "COMUM";

export type TreinoPapel = "participante" | "curador" | "administrador";

export type TreinoAtor = {
  userId: string;
  role: TreinoPerfil;
  /** leadership_lab.participante ativo deste usuário, ou null. */
  participanteId: string | null;
};

const perfisDoPapel: Record<TreinoPapel, readonly TreinoPerfil[]> = {
  participante: ["COMUM", "DEV"],
  curador: ["RH", "DEV"],
  administrador: ["ADMIN", "DEV"]
};

/** O perfil permite o papel? (O participante ainda precisa do vínculo: veja temVinculo.) */
export function perfilPermite(ator: Pick<TreinoAtor, "role">, papel: TreinoPapel): boolean {
  return perfisDoPapel[papel].includes(ator.role);
}

export function temVinculo(ator: TreinoAtor): ator is TreinoAtor & { participanteId: string } {
  return ator.participanteId !== null;
}

/** O alvo de uma leitura de tentativa: de quem é e de qual turma. */
export type TreinoAlvoDaTentativa = {
  participanteId: string;
  turmaCuradorId: string;
  turmaAtiva: boolean;
};

/**
 * Como o ator chega a uma tentativa: como dono, como curador da turma ou não chega (null = 404).
 * O dono vem primeiro: um DEV que é participante lê a própria tentativa como dono.
 */
export function acessoATentativa(
  ator: TreinoAtor,
  alvo: TreinoAlvoDaTentativa
): "dono" | "curador" | null {
  if (
    perfilPermite(ator, "participante") &&
    ator.participanteId !== null &&
    ator.participanteId === alvo.participanteId
  )
    return "dono";
  if (!perfilPermite(ator, "curador")) return null;
  if (ator.role === "DEV") return "curador";
  return alvo.turmaAtiva && alvo.turmaCuradorId === ator.userId ? "curador" : null;
}
