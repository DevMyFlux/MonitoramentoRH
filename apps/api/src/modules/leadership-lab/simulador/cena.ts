// Leadership Lab — a cena de uma situação da simulação local, para a tela.
//
// O contrato da IA não carrega o personagem (é coisa de apresentação), e o motor não conhece a
// biblioteca. Então as rotas pedem aqui, para cada situação mostrada, quem aparece na cena: o nó é
// refeito do cenário pelas escolhas já gravadas. Só sai o personagem e os nomes do tema: nada da
// avaliação. Qualquer falha devolve nulo: a ilustração é enfeite e nunca derruba o teste.
import type { LabCena, LabSimulacao } from "@my-flux/shared";
import type { PrismaClient } from "@prisma/client";
import { leitorDoPercurso } from "../demonstracao/leitor.js";
import { categoriaDa, cenarioDe } from "./catalogo.js";
import { nosDoPercurso } from "./percurso.js";
import { ehSimulacao, lerIdDaSimulacao } from "./provedor.js";

async function idDaSimulacao(db: PrismaClient, sessaoId: string) {
  const sessao = await db.labSessao.findUnique({
    where: { id: sessaoId },
    select: { iaSessaoId: true }
  });
  const ia = sessao?.iaSessaoId;
  if (!ia || !ehSimulacao(ia)) return null;
  const { nivel, categoriaId } = lerIdDaSimulacao(ia);
  const cenario = cenarioDe(categoriaId, nivel);
  const categoria = categoriaDa(categoriaId);
  if (!cenario || !categoria) return null;
  return { ia, cenario, categoria };
}

export async function simulacaoDaSessao(
  db: PrismaClient,
  sessaoId: string
): Promise<LabSimulacao | null> {
  try {
    const s = await idDaSimulacao(db, sessaoId);
    return s ? { temaNome: s.categoria.nome, titulo: s.cenario.titulo } : null;
  } catch {
    return null;
  }
}

export async function cenaDaSituacao(
  db: PrismaClient,
  sessaoId: string,
  numero: number
): Promise<LabCena | null> {
  try {
    const s = await idDaSimulacao(db, sessaoId);
    if (!s) return null;
    const passos = await leitorDoPercurso(db)(s.ia);
    const no = nosDoPercurso(s.cenario, passos, numero)[numero - 1];
    if (!no) return null;
    return {
      personagem: no.personagem,
      temaNome: s.categoria.nome,
      titulo: s.cenario.titulo
    };
  } catch {
    return null;
  }
}
