// Leadership Lab — o leitor do percurso da simulação local, sobre o banco.
//
// A IA de demonstração não guarda estado: a cada turno lê daqui as escolhas já gravadas e refaz o
// caminho do cenário. O motor grava a escolha ANTES de chamar a IA, então a do turno em curso já
// está aqui, mas a IA usa a que vem no pedido.
import type { PrismaClient } from "@prisma/client";
import type { LeitorDoPercurso } from "./ia-demonstracao.js";

export function leitorDoPercurso(db: PrismaClient): LeitorDoPercurso {
  return async (iaSessaoId) => {
    const turnos = await db.labTurno.findMany({
      where: { sessao: { iaSessaoId } },
      select: { numero: true, escolha: true },
      orderBy: { numero: "asc" }
    });
    return turnos.map((t) => ({
      numero: t.numero,
      escolha: t.escolha === "A" || t.escolha === "B" || t.escolha === "C" ? t.escolha : null
    }));
  };
}
