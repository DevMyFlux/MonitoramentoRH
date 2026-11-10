// Leadership Lab — as poses do facilitador 3D, uma por estado. Dados puros (sem three.js), para o
// que cada estado "faz" ser testável e para a cena só interpolar até o alvo.
import type { EstadoDoAvatar } from "./avatar-facilitador";

export type Pose = {
  /** Braço da frente: rotação em X (negativo levanta para a frente) e em Z (abre para o lado). */
  bracoX: number;
  bracoZ: number;
  /** Cotovelo dobrado (0 = braço esticado). */
  cotovelo: number;
  polegar: boolean;
  /** Cabeça: inclinação lateral (Z) e para cima/baixo (X). */
  cabecaZ: number;
  cabecaX: number;
  /** Boca: abertura média (0 a 1), amplitude da fala e largura relativa. */
  boca: number;
  fala: boolean;
  largura: number;
  /** Quanto o corpo "flutua" (refletindo). */
  flutua: boolean;
};

export const poses: Record<EstadoDoAvatar, Pose> = {
  // Aponta para a situação, com a boca em movimento.
  falando: {
    bracoX: -2.55,
    bracoZ: -0.25,
    cotovelo: 0.15,
    polegar: false,
    cabecaZ: 0,
    cabecaX: -0.05,
    boca: 0.35,
    fala: true,
    largura: 1,
    flutua: false
  },
  // Braços relaxados, cabeça inclinada: escuta.
  ouvindo: {
    bracoX: 0.05,
    bracoZ: -0.12,
    cotovelo: 0,
    polegar: false,
    cabecaZ: 0.2,
    cabecaX: 0,
    boca: 0.04,
    fala: false,
    largura: 0.8,
    flutua: false
  },
  // Mão no queixo, olhando para cima, flutuando de leve.
  refletindo: {
    bracoX: -1.35,
    bracoZ: 0.55,
    cotovelo: 1.9,
    polegar: false,
    cabecaZ: -0.12,
    cabecaX: -0.18,
    boca: 0.03,
    fala: false,
    largura: 0.6,
    flutua: true
  },
  // Joinha e sorriso.
  feedback: {
    bracoX: -1.25,
    bracoZ: -0.35,
    cotovelo: 0.9,
    polegar: true,
    cabecaZ: 0,
    cabecaX: 0.05,
    boca: 0.2,
    fala: false,
    largura: 1.4,
    flutua: false
  }
};

/** Aproxima `atual` de `alvo` de forma suave e independente da taxa de quadros. */
export function amortecer(atual: number, alvo: number, taxa: number, dt: number): number {
  return atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
}
