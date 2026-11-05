// Leadership Lab — os textos de tela para os valores fechados do módulo.
import type {
  LabAlertaCor,
  LabPersonagem,
  LabEscolha,
  LabEstilo,
  LabFlexibilidade,
  LabMotivoDeIndisponibilidade,
  LabSkillTipo,
  LabStatusValidacao
} from "@my-flux/shared";

export const nomeDoEstilo: Record<LabEstilo, string> = {
  direcao: "Direção",
  orientacao: "Orientação",
  apoio: "Apoio",
  delegacao: "Delegação"
};

export const nomeDaFlexibilidade: Record<LabFlexibilidade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa"
};

export const nomeDoTipoDeSkill: Record<LabSkillTipo, string> = {
  hard: "Hard skill",
  soft: "Soft skill"
};

export const nomeDoStatusDeValidacao: Record<LabStatusValidacao, string> = {
  aguardando_validacao: "Aguardando validação",
  validado: "Validado",
  ajustado: "Validado com ajuste"
};

export const nomeDoAlerta: Record<LabAlertaCor, string> = {
  vermelho: "Alerta vermelho",
  amarelo: "Alerta amarelo"
};

/** A letra da opção, na ordem em que o teclado a escolhe: 1, 2 e 3. */
export const teclaDaOpcao: Record<LabEscolha, string> = { A: "1", B: "2", C: "3" };

export const escolhaDaTecla: Record<string, LabEscolha> = { "1": "A", "2": "B", "3": "C" };

/** Por que o botão de iniciar não está disponível. */
export const motivoDeIndisponibilidade: Record<
  LabMotivoDeIndisponibilidade,
  { titulo: string; descricao: (limiteDiario: number | null) => string }
> = {
  "termo-pendente": {
    titulo: "Aceite o termo de ciência",
    descricao: () => "Para iniciar um teste, leia e aceite o termo de ciência acima."
  },
  "cargo-nao-informado": {
    titulo: "Seu cadastro não tem cargo informado",
    descricao: () => "Procure o RH para completar o seu cadastro."
  },
  "molde-nao-mapeado": {
    titulo: "Seu cargo ainda não tem um teste",
    descricao: () =>
      "O seu cargo ainda não está associado a um teste do Leadership Lab. Procure o RH."
  },
  "molde-inativo": {
    titulo: "O teste do seu cargo ainda não foi liberado",
    descricao: () => "Assim que for liberado, o botão para iniciar aparece aqui."
  },
  "limite-diario": {
    titulo: "Limite de testes de hoje atingido",
    descricao: (limite) =>
      limite === null
        ? "Volte amanhã."
        : `Você já fez ${limite} ${limite === 1 ? "teste" : "testes"} hoje. Volte amanhã.`
  }
};

/** "75" -> "75"; "88.33" -> "88,3". Uma casa decimal só quando há o que mostrar. */
export function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(valor);
}

export function formatarDataCurta(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(iso));
}

export function formatarDataEHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  );
}

/** 125000 -> "2:05" */
export function formatarRelogio(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${minutos}:${String(segundos).padStart(2, "0")}`;
}

/** Quem aparece na cena da simulação local. É um papel, nunca uma pessoa real. */
export const nomeDoPersonagem: Record<LabPersonagem, string> = {
  tecnico: "Técnico de manutenção",
  supervisor: "Supervisor",
  "responsavel-assistencial": "Responsável assistencial",
  "coordenador-contrato": "Coordenação do contrato",
  "engenharia-clinica": "Engenharia clínica",
  enfermagem: "Enfermagem",
  fornecedor: "Fornecedor",
  diretoria: "Diretoria",
  "seguranca-trabalho": "Segurança do trabalho",
  "controle-infeccao": "Controle de infecção"
};

export const descricaoDoEstado: Record<"falando" | "ouvindo" | "refletindo" | "feedback", string> =
  {
    falando: "apresentando a situação",
    ouvindo: "ouvindo a sua escolha",
    refletindo: "refletindo sobre a sua resposta",
    feedback: "mostrando o que aconteceu depois da sua escolha"
  };
