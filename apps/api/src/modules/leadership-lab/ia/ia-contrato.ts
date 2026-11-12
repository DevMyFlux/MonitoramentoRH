// Leadership Lab — contrato entre o backend e o serviço de IA (Python, Google ADK).
//
// A IA propõe; o backend valida, calcula e decide. Tudo o que volta do serviço passa por
// aqui antes de tocar o banco, o cálculo ou o participante, e tudo o que vai para ele sai
// de um schema ESTRITO: o schema de saída é a lista fechada de campos que podem chegar à
// IA, então nome, matrícula, e-mail, unidade ou ids do RH não passam sem mudar este arquivo.
//
// O QUE É DOCUMENTADO e o que é PROPOSTA:
//   - Documentado (docs do módulo, "Contrato do turno do agente_lab"): o JSON do turno, suas
//     regras de jogo e o bloco `uso`. Está em turnoIaSchema, exatamente como na documentação.
//   - PROPOSTA, a alinhar com o serviço na Etapa 2 (marcadas "PROPOSTA" abaixo): onde o bloco
//     `uso` fica no envelope, o formato da resposta da Guarda, os corpos das requisições e o
//     formato de `contribuicoes` no resultado. A documentação não os especifica.
//
// Os schemas são estritos de propósito: campo desconhecido ou ausente é violação do
// contrato, não algo a ignorar. Se o serviço real divergir, a divergência aparece no
// primeiro teste de contrato em vez de virar dado errado no banco.
import {
  type LabAgenteIa,
  type LabEscolha,
  type LabSkillId,
  labAderenciaEscala,
  labEscolhas,
  labConversaLimites,
  labDificuldades,
  labEstilos,
  labMoldeNiveis,
  labPapeisDaConversa,
  labProfundidadesTecnicas,
  labTiposDeFonte,
  labSituacaoDoMarco,
  labSkillsPiloto
} from "@my-flux/shared";
import { z } from "zod";

/** Máximo de situações por teste; é o mesmo limite da restrição ck_turno_numero. */
const MAX_SITUACOES = 10;

/** "Situação: até 60 palavras". Passar disso é aviso, não rejeição (veja `avisos`). */
export const LIMITE_PALAVRAS_SITUACAO = 60;

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

const texto = z.string().trim().min(1);
const numeroDaSituacao = z.int().min(1).max(MAX_SITUACOES);
const escolha = z.enum(labEscolhas);
const estilo = z.enum(labEstilos);
const aderencia = z.literal([...labAderenciaEscala]);
const idsDeSkills = labSkillsPiloto.map((s) => s.id) as unknown as [LabSkillId, ...LabSkillId[]];
const skill = z.enum(idsDeSkills);
const dificuldade = z.literal([...labDificuldades]);

/** Bloco `uso`: metadados de cada chamada, para o log_ia. Nunca conteúdo. PROPOSTA (campos). */
function uso<A extends LabAgenteIa>(agente: A) {
  return z.strictObject({
    agente: z.literal(agente),
    modelo: texto,
    versao_instrucao: texto,
    tokens_entrada: z.int().min(0).nullable(),
    tokens_saida: z.int().min(0).nullable()
  });
}

function opcao<I extends LabEscolha>(id: I) {
  return z.strictObject({ id: z.literal(id), texto });
}

// ---------------------------------------------------------------------------
// Turno do agente_lab (documentado)
// ---------------------------------------------------------------------------

/** A avaliação da escolha que o participante acabou de fazer (ou da omissão). */
export const avaliacaoAnteriorIaSchema = z
  .strictObject({
    numero: numeroDaSituacao,
    /** Nula quando o tempo esgotou. */
    escolha: escolha.nullable(),
    aderencia,
    /** Nulo quando a escolha não envolveu a equipe. */
    estilo: estilo.nullable(),
    skills: z.array(skill),
    alerta: z.literal("vermelho").nullable(),
    contribuicao: texto.nullable(),
    justificativa: texto
  })
  .superRefine((a, ctx) => {
    // Tempo esgotado conta como omissão: sem escolha, aderência 0. E só ele.
    if (a.escolha === null && a.aderencia !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["aderencia"],
        message: "sem escolha (tempo esgotado) a aderência é 0"
      });
    }
    if (a.escolha !== null && a.aderencia === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["aderencia"],
        message: "aderência 0 só existe quando o tempo esgotou"
      });
    }
    // Alerta vermelho se, e somente se, a aderência é 10.
    if (a.alerta === "vermelho" && a.aderencia !== 10) {
      ctx.addIssue({
        code: "custom",
        path: ["alerta"],
        message: "alerta vermelho só com aderência 10"
      });
    }
    if (a.aderencia === 10 && a.alerta === null) {
      ctx.addIssue({
        code: "custom",
        path: ["alerta"],
        message: "aderência 10 exige alerta vermelho"
      });
    }
    if (new Set(a.skills).size !== a.skills.length) {
      ctx.addIssue({ code: "custom", path: ["skills"], message: "skills repetidas" });
    }
  });

// ---------------------------------------------------------------------------
// Base pedagógica de uma situação (competências, dificuldade, fontes, fundamentação)
// ---------------------------------------------------------------------------

/** O identificador de uma ficha da base de conhecimento (slug estável). */
export const idDeFonteSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/);

/**
 * Em que a situação se apoia. A IA diz o que pretende desenvolver e quais fontes usou; quem diz se
 * a fundamentação é "validada" é o SERVIÇO (a partir do cadastro das fontes, nunca do modelo) e,
 * por último, o backend (`fundamentacaoFinal`, que também exige a rubrica validada). Ausente =
 * situação experimental.
 */
export const baseDaSituacaoSchema = z
  .strictObject({
    /** As competências (skills) que a situação pretende desenvolver. */
    competencias: z.array(skill).min(1).max(3),
    dificuldade: dificuldade,
    fontes: z.array(idDeFonteSchema).max(3),
    fundamentacao: z.enum(["validada", "experimental"])
  })
  .superRefine((b, ctx) => {
    if (b.fundamentacao === "validada" && b.fontes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["fundamentacao"],
        message: "fundamentação validada exige ao menos uma fonte"
      });
    }
    if (new Set(b.competencias).size !== b.competencias.length) {
      ctx.addIssue({ code: "custom", path: ["competencias"], message: "competências repetidas" });
    }
  });
export type BaseDaSituacao = z.infer<typeof baseDaSituacaoSchema>;

/** Uma situação com três respostas. */
export const situacaoIaSchema = z
  .strictObject({
    numero: numeroDaSituacao,
    marco: z.boolean(),
    estilo_adequado: estilo,
    texto,
    /** Sempre três: A, B e C, nessa ordem. */
    opcoes: z.tuple([opcao("A"), opcao("B"), opcao("C")]),
    /** Opcional por compatibilidade: sem ela, a situação é experimental. */
    base: baseDaSituacaoSchema.optional()
  })
  .superRefine((s, ctx) => {
    // A terceira situação é o marco, e só ela.
    if (s.marco !== (s.numero === labSituacaoDoMarco)) {
      ctx.addIssue({
        code: "custom",
        path: ["marco"],
        message: "o marco é a situação 3, e somente ela"
      });
    }
  });

/**
 * Fechamento do teste. NÃO traz números: aderência, agilidade, níveis, estilo e flexibilidade
 * são calculados pelo backend. Campo numérico aqui é violação do contrato.
 */
export const resultadoIaSchema = z.strictObject({
  resumo: texto,
  ponto_forte: texto,
  ponto_desenvolvimento: texto,
  sugestoes: z.array(texto),
  /** PROPOSTA: lista de textos. As contribuições por turno vêm em avaliacao_anterior. */
  contribuicoes: z.array(texto)
});

type FormaDaSituacao = {
  avaliacao_anterior: z.infer<typeof avaliacaoAnteriorIaSchema> | null;
  consequencia: string | null;
  situacao: z.infer<typeof situacaoIaSchema>;
};

/** Coerência interna de um turno `situacao`, sem saber o que o backend esperava. */
function regrasDoTurnoDeSituacao(t: FormaDaSituacao, ctx: z.RefinementCtx): void {
  if (t.situacao.numero === 1) {
    // Abertura: ainda não há o que avaliar nem consequência a mostrar.
    if (t.avaliacao_anterior !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["avaliacao_anterior"],
        message: "a primeira situação não avalia nada anterior"
      });
    }
    if (t.consequencia !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["consequencia"],
        message: "a primeira situação não tem consequência anterior"
      });
    }
    return;
  }
  if (t.avaliacao_anterior === null) {
    ctx.addIssue({
      code: "custom",
      path: ["avaliacao_anterior"],
      message: "obrigatória a partir da segunda situação"
    });
  } else if (t.avaliacao_anterior.numero !== t.situacao.numero - 1) {
    ctx.addIssue({
      code: "custom",
      path: ["avaliacao_anterior", "numero"],
      message: `deve avaliar a situação anterior (${t.situacao.numero - 1})`
    });
  }
  if (t.consequencia === null) {
    // Antes de cada nova situação, uma ou duas frases com o efeito da escolha anterior.
    ctx.addIssue({
      code: "custom",
      path: ["consequencia"],
      message: "obrigatória a partir da segunda situação"
    });
  }
}

const formaDoTurnoDeSituacao = {
  tipo: z.literal("situacao"),
  avaliacao_anterior: avaliacaoAnteriorIaSchema.nullable(),
  consequencia: texto.nullable(),
  situacao: situacaoIaSchema,
  resultado: z.null()
};

const formaDoTurnoDeResultado = {
  tipo: z.literal("resultado"),
  /** O último turno também avalia a última escolha. */
  avaliacao_anterior: avaliacaoAnteriorIaSchema,
  consequencia: texto.nullable(),
  situacao: z.null(),
  resultado: resultadoIaSchema
};

/**
 * O JSON do turno, como na documentação: `tipo` "situacao" ou "resultado". As duas chaves
 * `situacao` e `resultado` sempre existem; a que não se aplica é null.
 */
export const turnoIaSchema = z.discriminatedUnion("tipo", [
  z.strictObject(formaDoTurnoDeSituacao).superRefine(regrasDoTurnoDeSituacao),
  z.strictObject(formaDoTurnoDeResultado)
]);
export type TurnoIa = z.infer<typeof turnoIaSchema>;

// ---------------------------------------------------------------------------
// Envelopes das respostas do serviço (PROPOSTA: onde `uso` fica)
// ---------------------------------------------------------------------------

const usoDoAgenteLab = { uso: uso("agente_lab") };

/** Resposta de POST /teste/turnos: o turno com o bloco `uso` no mesmo nível. */
export const respostaTurnoIaSchema = z.discriminatedUnion("tipo", [
  z
    .strictObject({ ...formaDoTurnoDeSituacao, ...usoDoAgenteLab })
    .superRefine(regrasDoTurnoDeSituacao),
  z.strictObject({ ...formaDoTurnoDeResultado, ...usoDoAgenteLab })
]);
export type RespostaTurnoIa = z.infer<typeof respostaTurnoIaSchema>;

/**
 * Resposta de POST /teste/sessoes: o identificador OPACO da conversa e a primeira
 * situação. O backend não manda id de usuário; guarda este em sessao.ia_sessao_id.
 */
export const respostaAberturaIaSchema = z
  .strictObject({
    sessao_id: texto,
    ...formaDoTurnoDeSituacao,
    ...usoDoAgenteLab
  })
  .superRefine((r, ctx) => {
    regrasDoTurnoDeSituacao(r, ctx);
    if (r.situacao.numero !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["situacao", "numero"],
        message: "a abertura deve trazer a situação 1"
      });
    }
  });
export type RespostaAberturaIa = z.infer<typeof respostaAberturaIaSchema>;

// ---------------------------------------------------------------------------
// Requisições do backend para a IA (PROPOSTA: corpos). Lista fechada de campos.
// ---------------------------------------------------------------------------

/** O histórico individual resumido: sem identificação, só o que ajuda a adaptar a próxima situação. */
export const perfilResumidoIaSchema = z.strictObject({
  testes_considerados: z.int().min(0),
  testes_provisorios: z.int().min(0),
  skills: z
    .array(
      z.strictObject({
        skill,
        nivel: z.int().min(1).max(5),
        tendencia: z.enum(["subindo", "estavel", "caindo", "sem_base"]),
        testes: z.int().min(1),
        provisorio: z.boolean(),
        escolhas_fracas: z.int().min(0),
        recorrente: z.boolean()
      })
    )
    .max(5)
});
export type PerfilResumidoIa = z.infer<typeof perfilResumidoIaSchema>;

/**
 * O que o cargo cobra e a rubrica em vigor. Vem de packages/shared (nunca da IA) e é o que impede
 * a IA de cobrar de um coordenador o que é de um técnico.
 */
export const contextoPedagogicoIaSchema = z.strictObject({
  rubrica_versao: texto,
  responsabilidades: z.array(texto).max(8),
  foco: z.array(skill).max(8),
  profundidade_tecnica: z
    .array(z.strictObject({ skill, profundidade: z.enum(labProfundidadesTecnicas) }))
    .max(8),
  limite_tecnico: texto,
  /** A rubrica em vigor: o que cada nível da escala significa e o que observar em cada skill de foco. */
  rubrica: z.strictObject({
    niveis: z.array(z.strictObject({ aderencia, criterio: texto })).length(4),
    observar: z.array(z.strictObject({ skill, criterio: texto })).max(8)
  }),
  dificuldade_base: dificuldade,
  /** Nulo para quem ainda não tem testes concluídos. */
  perfil: perfilResumidoIaSchema.nullable()
});
export type ContextoPedagogicoIa = z.infer<typeof contextoPedagogicoIaSchema>;

/**
 * Só o que a IA precisa saber: o nível do molde, os temas, quantas situações e o contexto
 * pedagógico (o que o cargo cobra, a rubrica e o histórico resumido). Nada sobre o participante,
 * o colaborador, a operação ou a unidade.
 */
export const iniciarSessaoIaRequestSchema = z.strictObject({
  molde: z.enum(labMoldeNiveis),
  temas: z.array(texto).min(1),
  numero_situacoes: z.int().min(3).max(MAX_SITUACOES),
  /** Opcional por compatibilidade com serviços antigos; o motor sempre envia. */
  contexto: contextoPedagogicoIaSchema.optional()
});
export type IniciarSessaoIaRequest = z.infer<typeof iniciarSessaoIaRequestSchema>;

/**
 * A escolha do participante (ou a omissão por tempo esgotado) e o campo livre, que só pode
 * ter passado pela Guarda. A aderência nunca vai nem volta por aqui.
 */
export const proximoTurnoIaRequestSchema = z
  .strictObject({
    sessao_id: texto,
    /** Situação que está sendo respondida. Permite ao serviço detectar reenvio ou atraso. */
    numero: numeroDaSituacao,
    escolha: escolha.nullable(),
    tempo_esgotado: z.boolean(),
    texto_livre: texto.nullable()
  })
  .superRefine((r, ctx) => {
    if (r.tempo_esgotado !== (r.escolha === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["escolha"],
        message: "tempo esgotado e ausência de escolha andam juntos"
      });
    }
    if (r.tempo_esgotado && r.texto_livre !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["texto_livre"],
        message: "o campo livre só existe depois de responder"
      });
    }
  });
export type ProximoTurnoIaRequest = z.infer<typeof proximoTurnoIaRequestSchema>;

// ---------------------------------------------------------------------------
// Guarda (PROPOSTA: formato; a documentação só diz seguir, mascarar ou bloquear)
// ---------------------------------------------------------------------------

export const guardaIaRequestSchema = z.strictObject({ texto });
export type GuardaIaRequest = z.infer<typeof guardaIaRequestSchema>;

const usoDaGuarda = uso("guarda");
export const respostaGuardaIaSchema = z.discriminatedUnion("decisao", [
  /** Segue como está: o backend usa o texto que ele mesmo enviou. */
  z.strictObject({ decisao: z.literal("seguir"), texto: z.null(), uso: usoDaGuarda }),
  /** Segue com dados sensíveis mascarados: o backend usa SÓ o texto devolvido. */
  z.strictObject({ decisao: z.literal("mascarar"), texto, uso: usoDaGuarda }),
  /** Não segue: nada do texto é gravado nem enviado à IA. */
  z.strictObject({ decisao: z.literal("bloquear"), texto: z.null(), uso: usoDaGuarda })
]);
export type RespostaGuardaIa = z.infer<typeof respostaGuardaIaSchema>;

// ---------------------------------------------------------------------------
// Facilitador: conversa sobre o resultado (PROPOSTA: corpos e formato)
// ---------------------------------------------------------------------------

const situacaoDaConversa = z.strictObject({
  numero: numeroDaSituacao,
  marco: z.boolean(),
  texto,
  opcoes: z.array(z.strictObject({ id: escolha, texto })).length(3),
  escolha: escolha.nullable(),
  tempo_esgotado: z.boolean(),
  /** A justificativa que o participante já vê no resultado. Nunca o gabarito das outras opções. */
  justificativa: texto.nullable()
});

const resultadoDaConversaSchema = z.strictObject({
  resumo: texto,
  ponto_forte: texto.nullable(),
  ponto_desenvolvimento: texto.nullable(),
  sugestoes: z.array(texto),
  /** O nível que vale (o validado pelo RH, se houver). */
  skills: z.array(z.strictObject({ skill, nivel: z.int().min(1).max(5) })),
  situacoes: z.array(situacaoDaConversa).min(1).max(MAX_SITUACOES)
});

/**
 * O que a IA recebe para conversar. Dois modos:
 *  - `debriefing`: depois do teste, com o resultado que o participante já viu;
 *  - `aprendizagem`: fora de qualquer teste, sobre gestão, liderança e procedimentos, adaptada ao
 *    cargo e ao histórico resumido. Nunca durante uma situação cronometrada (o backend recusa).
 * Sem nome, matrícula, e-mail, ids, aderência, tempos nem avaliação das opções que ele não
 * escolheu. Mensagens do participante só saem depois da Guarda; o histórico vem do navegador e é
 * tratado como DADO, nunca como instrução.
 */
export const conversaIaRequestSchema = z
  .strictObject({
    modo: z.enum(["debriefing", "aprendizagem"]),
    molde: z.enum(labMoldeNiveis),
    mensagem: z.string().trim().min(1).max(labConversaLimites.mensagem),
    historico: z
      .array(
        z.strictObject({
          papel: z.enum(labPapeisDaConversa),
          texto: z.string().trim().min(1).max(labConversaLimites.textoDoHistorico)
        })
      )
      .max(labConversaLimites.historico),
    resultado: resultadoDaConversaSchema.nullable(),
    contexto: contextoPedagogicoIaSchema.nullable()
  })
  .superRefine((c, ctx) => {
    if (c.modo === "debriefing" && c.resultado === null) {
      ctx.addIssue({
        code: "custom",
        path: ["resultado"],
        message: "o debriefing exige o resultado"
      });
    }
    if (c.modo === "aprendizagem" && c.resultado !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["resultado"],
        message: "o modo aprendizagem não tem resultado"
      });
    }
    if (c.modo === "aprendizagem" && c.contexto === null) {
      ctx.addIssue({
        code: "custom",
        path: ["contexto"],
        message: "a aprendizagem exige o contexto"
      });
    }
  });
export type ConversaIaRequest = z.infer<typeof conversaIaRequestSchema>;

/** A fonte que o serviço usou, com o que o sistema precisa para citá-la. */
export const fonteCitadaIaSchema = z.strictObject({
  id: idDeFonteSchema,
  titulo: texto,
  instituicao: texto,
  tipo: z.enum(labTiposDeFonte),
  url: z.url({ protocol: /^https$/ }).nullable(),
  validada: z.boolean()
});

export const respostaConversaIaSchema = z.strictObject({
  resposta: z.string().trim().min(1).max(2000),
  /** Fontes da base de conhecimento em que a resposta se apoia. Vazio = conhecimento geral. */
  fontes: z.array(fonteCitadaIaSchema).max(3),
  uso: uso("facilitador")
});
export type RespostaConversaIa = z.infer<typeof respostaConversaIaSchema>;

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export type ResultadoDaValidacao<T> =
  | {
      ok: true;
      valor: T;
      /** Desvios de orientação que não rejeitam a resposta, para monitorar a IA. */
      avisos: string[];
    }
  | {
      ok: false;
      /** Texto "caminho: problema", pensado para a retentativa do serviço e para o log. */
      problemas: string[];
    };

function formatarCaminho(caminho: ReadonlyArray<PropertyKey>): string {
  return caminho.reduce<string>((acc, parte) => {
    if (typeof parte === "number") return `${acc}[${parte}]`;
    return acc === "" ? String(parte) : `${acc}.${String(parte)}`;
  }, "");
}

function descreverProblemas(erro: z.ZodError): string[] {
  return erro.issues.map((issue) => {
    const caminho = formatarCaminho(issue.path);
    return caminho === "" ? issue.message : `${caminho}: ${issue.message}`;
  });
}

function contarPalavras(valor: string): number {
  return valor.split(/\s+/).filter(Boolean).length;
}

function avisosDaSituacao(turno: { situacao: { numero: number; texto: string } | null }): string[] {
  const avisos: string[] = [];
  if (turno.situacao !== null) {
    const palavras = contarPalavras(turno.situacao.texto);
    if (palavras > LIMITE_PALAVRAS_SITUACAO) {
      avisos.push(
        `situacao.texto: ${palavras} palavras (orientação: até ${LIMITE_PALAVRAS_SITUACAO})`
      );
    }
  }
  return avisos;
}

/** Valida a resposta de POST /teste/sessoes. Nunca lança. */
export function validarAberturaIa(bruto: unknown): ResultadoDaValidacao<RespostaAberturaIa> {
  const lido = respostaAberturaIaSchema.safeParse(bruto);
  if (!lido.success) return { ok: false, problemas: descreverProblemas(lido.error) };
  return { ok: true, valor: lido.data, avisos: avisosDaSituacao(lido.data) };
}

/** O que o backend sabe sobre o turno que acabou de ser respondido. */
export type EsperadoDoTurno = {
  /** Número da situação respondida (ou esgotada). */
  numero: number;
  /** A letra enviada à IA. Nula quando o tempo esgotou. */
  escolha: LabEscolha | null;
  /** Total de situações do molde. Depois da última, a resposta é o resultado. */
  totalSituacoes: number;
};

/**
 * Valida a resposta de POST /teste/turnos contra o contrato E contra o que o backend
 * esperava. A IA não pode avaliar outra situação nem outra letra, nem encerrar o teste antes
 * da hora, nem prolongá-lo. Nunca lança por causa da resposta da IA; lança Error se o próprio
 * `esperado` for incoerente (defeito de quem chama).
 */
export function validarTurnoIa(
  bruto: unknown,
  esperado: EsperadoDoTurno
): ResultadoDaValidacao<RespostaTurnoIa> {
  if (
    !Number.isInteger(esperado.numero) ||
    esperado.numero < 1 ||
    !Number.isInteger(esperado.totalSituacoes) ||
    esperado.numero > esperado.totalSituacoes
  ) {
    throw new Error(
      `Estado esperado incoerente: situação ${esperado.numero} de ${esperado.totalSituacoes}.`
    );
  }

  const lido = respostaTurnoIaSchema.safeParse(bruto);
  if (!lido.success) return { ok: false, problemas: descreverProblemas(lido.error) };
  const turno = lido.data;

  const problemas: string[] = [];
  const avaliacao = turno.avaliacao_anterior;
  if (avaliacao === null) {
    problemas.push("avaliacao_anterior: obrigatória depois de uma resposta");
  } else {
    if (avaliacao.numero !== esperado.numero) {
      problemas.push(
        `avaliacao_anterior.numero: esperado ${esperado.numero}, recebido ${avaliacao.numero}`
      );
    }
    if (avaliacao.escolha !== esperado.escolha) {
      problemas.push(
        `avaliacao_anterior.escolha: esperado ${esperado.escolha ?? "nenhuma (tempo esgotado)"}, ` +
          `recebido ${avaliacao.escolha ?? "nenhuma"}`
      );
    }
  }

  const eraAUltima = esperado.numero === esperado.totalSituacoes;
  if (eraAUltima && turno.tipo !== "resultado") {
    problemas.push("tipo: depois da última situação a resposta deve ser 'resultado'");
  } else if (!eraAUltima && turno.tipo === "resultado") {
    problemas.push("tipo: ainda há situações; 'resultado' é prematuro");
  } else if (!eraAUltima && turno.tipo === "situacao") {
    if (turno.situacao.numero !== esperado.numero + 1) {
      problemas.push(
        `situacao.numero: esperado ${esperado.numero + 1}, recebido ${turno.situacao.numero}`
      );
    }
  }

  if (problemas.length > 0) return { ok: false, problemas };
  return { ok: true, valor: turno, avisos: avisosDaSituacao(turno) };
}

/** O que a Guarda decidiu, já traduzido para o que o backend pode gravar e enviar. */
export type AplicacaoDaGuarda = {
  decisao: "seguir" | "mascarar" | "bloquear";
  /**
   * O texto que PODE ser gravado em turno.texto_livre e enviado à IA: o original (seguir),
   * o mascarado (mascarar) ou nulo (bloquear). Combina com a restrição do banco.
   */
  texto: string | null;
  /** Falso quando a resposta da Guarda não obedeceu ao contrato (tratada como bloqueio). */
  respostaValida: boolean;
  uso: RespostaGuardaIa["uso"] | null;
  problemas: string[];
};

/**
 * Aplica a resposta da Guarda ao campo livre. FALHA FECHADA: qualquer resposta que não
 * cumpra o contrato (erro, tempo esgotado, JSON estranho, decisão desconhecida) bloqueia o
 * texto. Nunca lança.
 *
 * @param original texto do participante, já aparado e não vazio (veja guardaIaRequestSchema).
 * @param bruto o corpo da resposta da Guarda, ou o que sobrou dela: undefined, null, o que for.
 */
export function aplicarGuarda(original: string, bruto: unknown): AplicacaoDaGuarda {
  const lido = respostaGuardaIaSchema.safeParse(bruto);
  if (!lido.success) {
    return {
      decisao: "bloquear",
      texto: null,
      respostaValida: false,
      uso: null,
      problemas: descreverProblemas(lido.error)
    };
  }
  const { decisao, texto: filtrado, uso: usoDaChamada } = lido.data;
  return {
    decisao,
    texto: decisao === "seguir" ? original : filtrado,
    respostaValida: true,
    uso: usoDaChamada,
    problemas: []
  };
}

/** Valida a resposta de POST /agentes/facilitador. Nunca lança. */
export function validarConversaIa(bruto: unknown): ResultadoDaValidacao<RespostaConversaIa> {
  const lido = respostaConversaIaSchema.safeParse(bruto);
  if (!lido.success) return { ok: false, problemas: descreverProblemas(lido.error) };
  return { ok: true, valor: lido.data, avisos: [] };
}
