// Leadership Lab — ids que chegam pela URL.
import { z } from "zod";
import { erros } from "./motor/erros.js";

const uuid = z.uuid();

/**
 * Um id que nem é UUID não pode existir: responde o mesmo "não encontrado" de qualquer outro, em vez
 * de deixar o banco recusar com um erro técnico.
 */
export function idValido(valor: string): string {
  if (!uuid.safeParse(valor).success) throw erros.naoEncontrado();
  return valor;
}
