// Dados de exemplo dos cadastros do RH, tipados pelo contrato compartilhado.
import type {
  LabColaboradorDoCadastro,
  LabConfigDosMoldes,
  LabMoldeConfigurado,
  LabParticipanteDoCadastro,
  LabTurmaDetalhe,
  LabTurmaResumo,
  LabUsuarioElegivel
} from "@my-flux/shared";
import { AGORA } from "./dados-do-lab";

export function colaborador(
  extra: Partial<LabColaboradorDoCadastro> = {}
): LabColaboradorDoCadastro {
  return {
    id: "colaborador-1",
    nome: "Ana Souza",
    identificador: "MAT-001",
    cargo: "Supervisor de campo",
    operacao: "Operação Norte",
    molde: { nivel: "supervisor", nome: "Supervisor", liberado: true },
    ...extra
  };
}

export function usuario(extra: Partial<LabUsuarioElegivel> = {}): LabUsuarioElegivel {
  return { id: "usuario-1", nome: "Conta da Ana", email: "ana@exemplo.com", ...extra };
}

export function participante(
  extra: Partial<LabParticipanteDoCadastro> = {}
): LabParticipanteDoCadastro {
  return {
    id: "participante-1",
    ativo: true,
    vinculadoEm: AGORA,
    colaborador: colaborador(),
    usuario: usuario(),
    ...extra
  };
}

export function turma(extra: Partial<LabTurmaResumo> = {}): LabTurmaResumo {
  return {
    id: "turma-1",
    nome: "Supervisores 2026",
    ativa: true,
    criadaEm: AGORA,
    nParticipantes: 0,
    ...extra
  };
}

export function turmaDetalhe(extra: Partial<LabTurmaDetalhe> = {}): LabTurmaDetalhe {
  const participantes = extra.participantes ?? [];
  return {
    ...turma({ nParticipantes: participantes.length }),
    participantes,
    ...extra
  };
}

export function molde(extra: Partial<LabMoldeConfigurado> = {}): LabMoldeConfigurado {
  return {
    id: "molde-supervisor",
    nivel: "supervisor",
    nome: "Supervisor",
    temas: ["Comunicação", "Gestão de equipe"],
    numeroSituacoes: 5,
    tempoLimiteS: null,
    ativo: false,
    cargoIds: [],
    testesEmAndamento: 0,
    ...extra
  };
}

export function configDosMoldes(extra: Partial<LabConfigDosMoldes> = {}): LabConfigDosMoldes {
  return {
    moldes: [
      molde({ id: "molde-encarregado", nivel: "encarregado", nome: "Encarregado" }),
      molde(),
      molde({ id: "molde-coordenador", nivel: "coordenador", nome: "Coordenador" })
    ],
    cargos: [
      { id: "cargo-1", nome: "Supervisor de campo", moldeNivel: null },
      { id: "cargo-2", nome: "Coordenador de planta", moldeNivel: "coordenador" }
    ],
    ...extra
  };
}
