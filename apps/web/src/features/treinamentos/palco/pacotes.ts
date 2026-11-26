// Pacotes de cena: o vocabulário visual de um cenário (scenePack). Cada pacote define os planos de
// câmera (shots), o estado inicial dos comandos e a descrição em texto da cena (leitor de tela). O
// "mundo" em SVG fica em mundos.tsx. Pacote desconhecido cai no genérico: fundo escuro, legenda e
// painel, nunca quebra.
import { ESCRITORIO_GESTAO } from "@my-flux/shared";
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
  /** Indicadores do HUD que dependem do estado (ex.: pendências). Opcional. */
  indicadores?: (estado: EstadoDaCena) => IndicadorDoHud[];
};

/** Um indicador do HUD: o rótulo, o valor e o tom (o tom sempre acompanha o texto, nunca só a cor). */
export type IndicadorDoHud = {
  rotulo: string;
  valor: string;
  tom: "ok" | "atencao" | "risco" | "neutro";
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

/**
 * Escritório de gestão (os cenários do Leadership Lab: supervisor, coordenador, RH e administrativo):
 * a mesa de trabalho, a tela do sistema, a sala de reunião, a ficha de papel e o relógio com o
 * calendário. Cada plano comanda o objeto de mesmo nome com "ok", "alerta" ou "falha".
 */
export const escritorioGestao: PacoteDeCena = {
  id: ESCRITORIO_GESTAO.id,
  planos: {
    geral: GERAL,
    mesa: { cx: 570, cy: 690, escala: 2 },
    tela: { cx: 550, cy: 290, escala: 1.9 },
    reuniao: { cx: 1240, cy: 585, escala: 2.3 },
    documento: { cx: 1060, cy: 290, escala: 2.2 },
    relogio: { cx: 1380, cy: 260, escala: 2.2 }
  },
  estadoInicial: { mesa: "", tela: "", reuniao: "", documento: "", relogio: "" },
  descrever: (e) => {
    const frase = (
      valor: string | undefined,
      textos: { ok: string; alerta: string; falha: string; neutro: string }
    ) =>
      valor === "ok" || valor === "alerta" || valor === "falha" ? textos[valor] : textos.neutro;
    return [
      "Escritório de gestão: a tela do sistema, a ficha de papel, o relógio com o calendário, a sala de reunião e a mesa de trabalho.",
      frase(e.mesa, {
        ok: "A mesa está em ordem, com a luminária acesa.",
        alerta: "O telefone da mesa pisca em âmbar.",
        falha: "A mesa está bagunçada e o telefone pisca em vermelho.",
        neutro: "A mesa tem o monitor, o telefone e uma pilha de papéis."
      }),
      frase(e.tela, {
        ok: "A tela do sistema mostra o registro correto, com um selo de confirmação.",
        alerta: "A tela do sistema destaca uma linha em âmbar, com um aviso.",
        falha: "A tela do sistema destaca uma linha em vermelho, com um erro.",
        neutro: "A tela do sistema mostra uma planilha."
      }),
      frase(e.documento, {
        ok: "A ficha de papel está carimbada como conferida.",
        alerta: "A ficha de papel tem um carimbo de atenção.",
        falha: "A ficha de papel está torta e com um carimbo de erro.",
        neutro: "A ficha de papel está presa no quadro."
      }),
      frase(e.relogio, {
        ok: "O relógio e o calendário mostram o prazo em dia.",
        alerta: "O relógio e o calendário mostram o prazo apertado.",
        falha: "O relógio e o calendário mostram o prazo estourado.",
        neutro: "O relógio de parede e o calendário marcam o tempo passar."
      }),
      frase(e.reuniao, {
        ok: "Na sala de reunião, o balão mostra o alinhamento confirmado.",
        alerta: "Na sala de reunião, o balão mostra uma dúvida em aberto.",
        falha: "Na sala de reunião, o balão mostra um problema sem tratamento.",
        neutro: "Na sala de reunião, três pessoas em silhueta ao redor da mesa."
      })
    ].join(" ");
  },
  // Poeira no ar; brasas quando alguma frente falhou (a tensão da cena).
  particulas: (e) => (ESCRITORIO_GESTAO.planos.some((p) => e[p] === "falha") ? "brasas" : "poeira"),
  // Pendências: quantas frentes ainda não estão resolvidas ("ok"). Começa em 5, desce a cada "ok" e
  // sobe de volta se uma frente que estava ok passa a alerta ou falha.
  indicadores: (e) => {
    const pendentes = ESCRITORIO_GESTAO.planos.filter((p) => e[p] !== "ok").length;
    const falhou = ESCRITORIO_GESTAO.planos.some((p) => e[p] === "falha");
    const alertou = ESCRITORIO_GESTAO.planos.some((p) => e[p] === "alerta");
    return [
      {
        rotulo: "Pendências",
        valor: String(pendentes),
        tom: pendentes === 0 ? "ok" : falhou ? "risco" : alertou ? "atencao" : "neutro"
      }
    ];
  }
};

const pacotes: Readonly<Record<string, PacoteDeCena>> = {
  [hospitalEnergia.id]: hospitalEnergia,
  [hospitalEscala.id]: hospitalEscala,
  [escritorioGestao.id]: escritorioGestao
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
