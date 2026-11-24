// Pacotes de cena: o vocabulário visual de um cenário (scenePack). Cada pacote define os planos de
// câmera (shots), o estado inicial dos comandos e a descrição em texto da cena (leitor de tela). O
// "mundo" em SVG fica em mundos.tsx. Pacote desconhecido cai no genérico: fundo escuro, legenda e
// painel, nunca quebra.
import type { EstadoDaCena } from "../fluxo";

/** Ponto que a câmera centraliza (no viewBox 1600×900) e o zoom. */
export type Camera = { cx: number; cy: number; escala: number };

export type PacoteDeCena = {
  id: string;
  planos: Readonly<Record<string, Camera>>;
  estadoInicial: EstadoDaCena;
  /** Descrição curta do que está na cena agora (aria-label do SVG). */
  descrever: (estado: EstadoDaCena) => string;
  /** Partículas para o estado: faíscas, brasas, poeira ou nenhuma. */
  particulas: (estado: EstadoDaCena) => ModoDasParticulas;
};

export type ModoDasParticulas = "nenhuma" | "faiscas" | "brasas" | "poeira";

export const LARGURA_DA_CENA = 1600;
export const ALTURA_DA_CENA = 900;
const GERAL: Camera = { cx: 800, cy: 450, escala: 1 };

const rotulo = (mapa: Record<string, string>, valor: string | undefined, padrao: string) =>
  (valor && mapa[valor]) ?? padrao;

export const hospitalEnergia: PacoteDeCena = {
  id: "hospital-energia",
  planos: {
    wide: GERAL,
    icu: { cx: 380, cy: 430, escala: 1.7 },
    tech: { cx: 1040, cy: 540, escala: 1.5 },
    ppe: { cx: 980, cy: 560, escala: 1.9 },
    cab: { cx: 1215, cy: 430, escala: 2.2 },
    lever: { cx: 1250, cy: 470, escala: 2.7 }
  },
  estadoInicial: { icu: "none", epi: "0", lock: "0", led: "amber", state: "", tvt: "", tech: "" },
  descrever: (e) =>
    [
      "Corredor do hospital à noite, com a porta da UTI à esquerda e o quadro elétrico à direita.",
      rotulo(
        { ok: "A UTI está avisada e preparada.", alert: "Luz de alerta girando na porta da UTI." },
        e.icu,
        "A UTI não sabe da intervenção."
      ),
      e.epi === "1" ? "O técnico veste o EPI completo." : "O técnico está sem EPI.",
      e.lock === "1"
        ? "O disjuntor está travado com cadeado e etiqueta."
        : "O disjuntor não está bloqueado.",
      rotulo(
        {
          green: "Luz verde no quadro: sem tensão.",
          red: "Luz vermelha no quadro.",
          amber: "Luz âmbar: o quadro está aquecendo."
        },
        e.led,
        ""
      ),
      e.state === "arc"
        ? "Um arco elétrico explode no quadro."
        : e.state === "safe"
          ? "O quadro está desligado com segurança."
          : "",
      e.tech === "ferido"
        ? "O técnico foi atingido."
        : e.tech === "protegido"
          ? "O EPI protegeu o técnico."
          : ""
    ]
      .filter(Boolean)
      .join(" "),
  particulas: (e) =>
    e.state === "arc"
      ? "faiscas"
      : e.state === "safe"
        ? "poeira"
        : e.led === "amber"
          ? "brasas"
          : "poeira"
};

export const generico: PacoteDeCena = {
  id: "generico",
  planos: {},
  estadoInicial: {},
  descrever: () => "Cena do treinamento.",
  particulas: () => "poeira"
};

/**
 * Sala de gestão da escala (cenários de RH): painel da escala (grade D/N/F), ficha do
 * colaborador, relógio do descanso entre jornadas e a equipe do plantão.
 */
export const hospitalEscala: PacoteDeCena = {
  id: "hospital-escala",
  planos: {
    sala: GERAL,
    painel: { cx: 560, cy: 300, escala: 1.9 },
    ficha: { cx: 1110, cy: 520, escala: 2.1 },
    relogio: { cx: 1360, cy: 250, escala: 2.6 },
    equipe: { cx: 300, cy: 600, escala: 2 }
  },
  estadoInicial: { painel: "alerta", ficha: "pendente", relogio: "", escala: "errada", equipe: "" },
  descrever: (e) =>
    [
      "Sala de gestão da escala à noite: o painel da escala na parede, a ficha do colaborador na tela, o relógio e a equipe do plantão.",
      e.painel === "ok"
        ? "O painel da escala está em dia."
        : "O painel da escala mostra um alerta de falta.",
      e.escala === "ok"
        ? "A escala do plantão mostra o substituto no posto."
        : "A escala ainda aponta quem faltou.",
      e.ficha === "ok"
        ? "A ficha do substituto está com os documentos em dia."
        : "A ficha do substituto tem itens pendentes.",
      e.relogio === "ok"
        ? "O relógio mostra o descanso entre jornadas cumprido."
        : e.relogio === "curto"
          ? "O relógio mostra descanso entre jornadas abaixo do mínimo."
          : "",
      e.equipe === "ok"
        ? "A equipe confirmou quem cobre o posto."
        : e.equipe === "duvida"
          ? "A equipe está em dúvida sobre quem cobre o posto."
          : ""
    ]
      .filter(Boolean)
      .join(" "),
  particulas: () => "poeira"
};

const pacotes: Readonly<Record<string, PacoteDeCena>> = {
  [hospitalEnergia.id]: hospitalEnergia,
  [hospitalEscala.id]: hospitalEscala
};

/** O pacote pelo id; desconhecido = genérico. */
export function pacoteDeCena(id: string): PacoteDeCena {
  return pacotes[id] ?? generico;
}

/** O plano de câmera; desconhecido = plano geral. */
export function cameraDoPlano(pacote: PacoteDeCena, plano: string | undefined): Camera {
  return (plano && pacote.planos[plano]) || GERAL;
}

/** O transform SVG que centraliza a câmera no quadro. */
export function transformDaCamera({ cx, cy, escala }: Camera, tremor = { x: 0, y: 0 }): string {
  const x = LARGURA_DA_CENA / 2 - cx * escala + tremor.x;
  const y = ALTURA_DA_CENA / 2 - cy * escala + tremor.y;
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${escala.toFixed(4)})`;
}
