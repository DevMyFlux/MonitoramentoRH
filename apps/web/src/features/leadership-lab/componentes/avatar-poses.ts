// Leadership Lab — o "jeito" do facilitador 3D em cada estado. Dados puros (sem three.js), para o
// que cada estado faz ser testável e para a cena só interpolar até o alvo.
import type { EstadoDoAvatar } from "./avatar-facilitador";

export type Pose = {
  /** Inclinação lateral do corpo, em radianos. */
  inclina: number;
  /** Quanto ele se aproxima da câmera (eixo Z), em unidades da cena. */
  avanca: number;
  /** Balanço lateral contínuo: amplitude (rad) e frequência (rad/s). */
  balanca: number;
  balancaFreq: number;
  /** Pulso de escala ("fala"): amplitude e frequência. */
  pulso: number;
  pulsoFreq: number;
  /** Flutuação vertical: amplitude em unidades da cena e frequência. */
  flutua: number;
  flutuaFreq: number;
  /** Quanto o olhar (a rotação) acompanha o ponteiro do mouse. */
  segue: number;
};

export const poses: Record<EstadoDoAvatar, Pose> = {
  // Aponta para a situação: pulsa no ritmo da fala e balança de leve.
  falando: {
    inclina: 0,
    avanca: 0.05,
    balanca: 0.025,
    balancaFreq: 2.4,
    pulso: 0.012,
    pulsoFreq: 9,
    flutua: 0.01,
    flutuaFreq: 1.8,
    segue: 0.35
  },
  // Inclina-se para ouvir, quase parado, acompanhando o ponteiro.
  ouvindo: {
    inclina: 0.07,
    avanca: 0.22,
    balanca: 0,
    balancaFreq: 0,
    pulso: 0,
    pulsoFreq: 0,
    flutua: 0.008,
    flutuaFreq: 1.4,
    segue: 0.55
  },
  // Flutua devagar, balançando, "pensando".
  refletindo: {
    inclina: -0.04,
    avanca: 0,
    balanca: 0.05,
    balancaFreq: 1.1,
    pulso: 0,
    pulsoFreq: 0,
    flutua: 0.045,
    flutuaFreq: 2,
    segue: 0.2
  },
  // Comemora: salta num ritmo curto.
  feedback: {
    inclina: 0,
    avanca: 0.1,
    balanca: 0.03,
    balancaFreq: 5,
    pulso: 0.02,
    pulsoFreq: 6,
    flutua: 0.035,
    flutuaFreq: 6,
    segue: 0.25
  }
};

/** Aproxima `atual` de `alvo` de forma suave e independente da taxa de quadros. */
export function amortecer(atual: number, alvo: number, taxa: number, dt: number): number {
  return atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
}

/** Largura sobre altura da imagem do facilitador (`facilitador.webp`). */
export const PROPORCAO_DO_FACILITADOR = 663 / 1100;
