// Contexto do assistente (título e sugestões) das telas dos módulos OCULTOS. Só vale com o módulo
// ativo no registro; oculto, o assistente nem sabe que a tela existe.
import { MODULOS, type ModuloDef } from "@my-flux/shared";

export type ContextoOculto = { prefixo: string; titulo: string; sugestoes: readonly string[] };

export function contextosOcultos(
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): ContextoOculto[] {
  const contextos: ContextoOculto[] = [];
  if (registro.qlp?.status === "active")
    contextos.push({
      prefixo: "/qlp",
      titulo: "QLP",
      sugestoes: ["O que é o QLP?", "Como o QLP gera posições?"]
    });
  if (registro.recrutamento?.status === "active")
    contextos.push({
      prefixo: "/recrutamento",
      titulo: "Recrutamento",
      sugestoes: ["Como abro uma vaga?", "Como concluo uma admissão?"]
    });
  return contextos;
}
