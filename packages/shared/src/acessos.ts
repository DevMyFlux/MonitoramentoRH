// can(ator, ação, alvo): UMA função pura que decide quem pode o quê, usada pela API e pela interface.
// A interface só esconde o que o servidor já nega: quem barra é a API, com esta mesma função.
//
// Retorna uma decisão com o MOTIVO da negação, porque o motivo manda no código HTTP:
//   - "perfil" e "proprio"       → 403 (a pessoa sabe que existe, mas não pode);
//   - "alheio", "modulo-oculto" e
//     "modulo-desconhecido"      → 404 igual ao de "não existe" (não revela que o recurso existe);
//   - "ultimo-dev"               → 409 (conflito com a regra de preservar o último DEV);
//   - "alvo-invalido"            → 400 (dados do alvo incoerentes: nega por segurança).
//
// Regras desta matriz (Prompt 2, seção 1):
//   * ninguém altera o PRÓPRIO perfil, nem se desativa ou remove;
//   * DEV gerencia qualquer perfil, inclusive outro DEV; ADMIN só RH e COMUM (nunca DEV nem ADMIN);
//     RH só COMUM; COMUM não gerencia ninguém;
//   * o último DEV ativo não é rebaixado, desativado nem removido;
//   * COMUM só vê o Leadership Lab e os resultados dele; resultados de teste interno (feito por
//     DEV, ADMIN ou RH) são só da equipe;
//   * módulo oculto é negado a TODOS os perfis.
import { MODULOS, type ModuloDef } from "./modules.js";

export type PerfilDeAcesso = "DEV" | "ADMIN" | "RH" | "COMUM";
export const perfisDeAcesso: readonly PerfilDeAcesso[] = ["DEV", "ADMIN", "RH", "COMUM"];

export type AtorDeAcesso = { id: string; role: PerfilDeAcesso };

/** Quem fez o teste: um COMUM ("participante") ou a equipe, para validar e demonstrar ("interno"). */
export type OrigemDoResultado = "interno" | "participante";

type Resultado = { donoId: string; donoPerfil: PerfilDeAcesso; origem: OrigemDoResultado };
type UsuarioAlvo = { id: string; perfil: PerfilDeAcesso; devsAtivos: number };

/** O alvo de cada ação. `undefined` = ação sem alvo. */
export type AlvosDeAcesso = {
  "modulo:ver": { moduloId: string };
  "modulo:escrever": { moduloId: string };
  "usuario:criar": { perfil: PerfilDeAcesso };
  "usuario:editar": { id: string; perfil: PerfilDeAcesso };
  "usuario:alterar-perfil": UsuarioAlvo & { novoPerfil: PerfilDeAcesso };
  "usuario:desativar": UsuarioAlvo;
  "usuario:remover": UsuarioAlvo;
  "lab:fazer-teste": undefined;
  "lab:ver-resultado": Resultado;
  "lab:validar-resultado": Resultado;
  "lab:contestar": Resultado;
  "lab:decidir-contestacao": Resultado;
  "lab:ver-acompanhamento": undefined;
  "area:ler": undefined;
  "area:editar": undefined;
  "treinamento:ler-config": undefined;
  "treinamento:editar-config": undefined;
  "treinamento:aprovar": undefined;
  "assistente:usar": undefined;
};
export type AcaoDeAcesso = keyof AlvosDeAcesso;
export const acoesDeAcesso = [
  "modulo:ver",
  "modulo:escrever",
  "usuario:criar",
  "usuario:editar",
  "usuario:alterar-perfil",
  "usuario:desativar",
  "usuario:remover",
  "lab:fazer-teste",
  "lab:ver-resultado",
  "lab:validar-resultado",
  "lab:contestar",
  "lab:decidir-contestacao",
  "lab:ver-acompanhamento",
  "area:ler",
  "area:editar",
  "treinamento:ler-config",
  "treinamento:editar-config",
  "treinamento:aprovar",
  "assistente:usar"
] as const satisfies readonly AcaoDeAcesso[];

export type MotivoDaNegacao =
  | "perfil"
  | "proprio"
  | "alheio"
  | "ultimo-dev"
  | "modulo-oculto"
  | "modulo-desconhecido"
  | "alvo-invalido";
export type DecisaoDaPolitica = { permitido: true } | { permitido: false; motivo: MotivoDaNegacao };

const permitido: DecisaoDaPolitica = { permitido: true };
const negar = (motivo: MotivoDaNegacao): DecisaoDaPolitica => ({ permitido: false, motivo });

/** O código HTTP que cada motivo de negação deve virar. */
export function statusHttpDaNegacao(motivo: MotivoDaNegacao): 400 | 403 | 404 | 409 {
  switch (motivo) {
    case "perfil":
    case "proprio":
      return 403;
    case "alheio":
    case "modulo-oculto":
    case "modulo-desconhecido":
      return 404;
    case "ultimo-dev":
      return 409;
    case "alvo-invalido":
      return 400;
  }
}

/** Que perfis cada perfil gerencia (cria, edita, desativa, remove, concede, retira). */
const PERFIS_GERENCIADOS: Readonly<Record<PerfilDeAcesso, readonly PerfilDeAcesso[]>> = {
  DEV: ["DEV", "ADMIN", "RH", "COMUM"],
  ADMIN: ["RH", "COMUM"],
  RH: ["COMUM"],
  COMUM: []
};

/** O perfil `ator` gerencia contas do perfil `alvo`? (Não olha quem é a pessoa: só o perfil.) */
export function perfilGerencia(ator: PerfilDeAcesso, alvo: PerfilDeAcesso): boolean {
  return PERFIS_GERENCIADOS[ator].includes(alvo);
}

const naEquipe = (perfil: PerfilDeAcesso) => perfil !== "COMUM";

function decidirModulo(
  ator: AtorDeAcesso,
  moduloId: string,
  escrevendo: boolean,
  registro: Readonly<Record<string, ModuloDef>>
): DecisaoDaPolitica {
  const modulo = registro[moduloId];
  if (!modulo) return negar("modulo-desconhecido");
  if (modulo.status === "hidden") return negar("modulo-oculto");
  if (ator.role === "COMUM") {
    // No Lab o COMUM faz o teste e lê o que é dele (ações lab:*); não "escreve" no módulo.
    return modulo.comumPode && !escrevendo ? permitido : negar("perfil");
  }
  return permitido;
}

function decidirGestaoDeUsuario(
  ator: AtorDeAcesso,
  alvo: UsuarioAlvo,
  novoPerfil?: PerfilDeAcesso
): DecisaoDaPolitica {
  if (ator.id === alvo.id) return negar("proprio");
  if (!perfilGerencia(ator.role, alvo.perfil)) return negar("perfil");
  if (novoPerfil !== undefined && !perfilGerencia(ator.role, novoPerfil)) return negar("perfil");
  // O último DEV ativo fica: nem rebaixado, nem desativado, nem removido.
  const deixariaDeSerDev =
    alvo.perfil === "DEV" && (novoPerfil === undefined || novoPerfil !== "DEV");
  if (deixariaDeSerDev && alvo.devsAtivos <= 1) return negar("ultimo-dev");
  return permitido;
}

/** Resultado de teste: os dados são coerentes? (interno ⇔ feito por quem não é COMUM) */
const resultadoCoerente = (r: Resultado) => (r.origem === "interno") === naEquipe(r.donoPerfil);

/**
 * Decide uma ação. `registro` é o registro de módulos (o de produção por padrão); os testes passam
 * um registro próprio para exercitar módulos ocultos e ativos.
 */
export function decidirAcesso<A extends AcaoDeAcesso>(
  ator: AtorDeAcesso,
  acao: A,
  alvo: AlvosDeAcesso[A],
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): DecisaoDaPolitica {
  // Cada caso estreita o alvo pelo nome da ação.
  const a = alvo as unknown;
  switch (acao) {
    case "modulo:ver":
      return decidirModulo(ator, (a as AlvosDeAcesso["modulo:ver"]).moduloId, false, registro);
    case "modulo:escrever":
      return decidirModulo(ator, (a as AlvosDeAcesso["modulo:escrever"]).moduloId, true, registro);

    case "usuario:criar":
      return perfilGerencia(ator.role, (a as AlvosDeAcesso["usuario:criar"]).perfil)
        ? permitido
        : negar("perfil");
    case "usuario:editar": {
      const t = a as AlvosDeAcesso["usuario:editar"];
      // Editar os próprios dados é outro caminho (perfil da pessoa): aqui vale só a hierarquia.
      return perfilGerencia(ator.role, t.perfil) ? permitido : negar("perfil");
    }
    case "usuario:alterar-perfil": {
      const t = a as AlvosDeAcesso["usuario:alterar-perfil"];
      return decidirGestaoDeUsuario(ator, t, t.novoPerfil);
    }
    case "usuario:desativar":
    case "usuario:remover":
      return decidirGestaoDeUsuario(ator, a as UsuarioAlvo);

    case "lab:fazer-teste":
      // Todos os perfis fazem o teste (a equipe, para validar e demonstrar: origem "interno").
      return permitido;
    case "lab:ver-resultado": {
      const r = a as Resultado;
      if (!resultadoCoerente(r)) return negar("alvo-invalido");
      if (r.donoId === ator.id) return permitido;
      if (ator.role === "COMUM") return negar("alheio");
      return permitido; // DEV, ADMIN (leitura) e RH, de COMUNS e da equipe
    }
    case "lab:validar-resultado": {
      const r = a as Resultado;
      if (!resultadoCoerente(r)) return negar("alvo-invalido");
      if (r.donoId === ator.id) return negar("proprio");
      // Só se valida resultado de participante, e só RH e DEV (o ADMIN lê).
      if (r.origem !== "participante") return negar("alheio");
      return ator.role === "RH" || ator.role === "DEV" ? permitido : negar("perfil");
    }
    case "lab:contestar": {
      const r = a as Resultado;
      if (!resultadoCoerente(r)) return negar("alvo-invalido");
      // Só o próprio COMUM contesta o próprio resultado de participante.
      if (r.origem !== "participante" || r.donoId !== ator.id) return negar("alheio");
      return ator.role === "COMUM" ? permitido : negar("perfil");
    }
    case "lab:decidir-contestacao": {
      const r = a as Resultado;
      if (!resultadoCoerente(r)) return negar("alvo-invalido");
      if (r.donoId === ator.id) return negar("proprio");
      if (r.origem !== "participante") return negar("alheio");
      return naEquipe(ator.role) ? permitido : negar("perfil");
    }
    case "lab:ver-acompanhamento":
    case "treinamento:ler-config":
      return naEquipe(ator.role) ? permitido : negar("perfil");
    case "area:ler":
      // Quem cadastra contas precisa ver as áreas para escolher uma.
      return naEquipe(ator.role) ? permitido : negar("perfil");
    case "area:editar":
    case "treinamento:editar-config":
    case "treinamento:aprovar":
      // DEV e ADMIN editam e aprovam; o RH só lê e comenta.
      return ator.role === "DEV" || ator.role === "ADMIN" ? permitido : negar("perfil");
    case "assistente:usar":
      // Todos usam; o COMUM com escopo restrito (veja politicaDoAssistente).
      return permitido;
  }
  return negar("perfil");
}

/** A forma curta: pode ou não pode. Para saber o porquê (e o código HTTP), use decidirAcesso. */
export function can<A extends AcaoDeAcesso>(
  ator: AtorDeAcesso,
  acao: A,
  alvo: AlvosDeAcesso[A],
  registro: Readonly<Record<string, ModuloDef>> = MODULOS
): boolean {
  return decidirAcesso(ator, acao, alvo, registro).permitido;
}

/** O que o assistente de IA pode para cada perfil. A API monta o contexto da conversa com isto. */
export type PoliticaDoAssistente = {
  /** Sem teto de mensagens por hora. */
  ilimitado: boolean;
  /** "completo": qualquer página, processo ou área. "lab-proprio": só o Leadership Lab e o resultado da pessoa. */
  escopo: "completo" | "lab-proprio";
  /** Pode pedir consulta a dados de pessoas (conferida no servidor antes de rodar). */
  podeConsultarDados: boolean;
};

export function politicaDoAssistente(perfil: PerfilDeAcesso): PoliticaDoAssistente {
  const equipe = naEquipe(perfil);
  return {
    ilimitado: equipe,
    escopo: equipe ? "completo" : "lab-proprio",
    podeConsultarDados: equipe
  };
}
