// Para onde o usuário vai depois de entrar. O participante do Leadership Lab (perfil COMUM) vai
// direto para o painel dele; os demais perfis continuam indo para Colaboradores, como sempre.
import type { Role } from "@my-flux/types";

export function destinoInicial(perfil: Role | undefined): string {
  return perfil === "COMUM" ? "/lab" : "/colaboradores";
}
