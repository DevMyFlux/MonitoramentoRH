// Exemplos do contrato com a IA, para os testes (e para o time do serviço Python usar nos
// testes de contrato do lado dele). Cada função devolve um objeto NOVO, que o teste pode
// alterar. O turno 2 é o JSON da documentação, com os "..." preenchidos.

export type Json = Record<string, unknown>;

export function usoExemplo(agente = "agente_lab"): Json {
  return {
    agente,
    modelo: "modelo-de-teste",
    versao_instrucao: "2026-03-01",
    tokens_entrada: 1200,
    tokens_saida: 340
  };
}

export function opcoesExemplo(): Json[] {
  return [
    { id: "A", texto: "Remarcar a OS e avisar o solicitante antes de mexer na agenda." },
    { id: "B", texto: "Remarcar a OS e registrar o aviso ao solicitante no fim do dia." },
    { id: "C", texto: "Manter a OS e pedir mais uma hora ao solicitante, sem registrar." }
  ];
}

/** A avaliação do que acabou de acontecer. Padrão: situação 1, escolha B, aderência 70. */
export function avaliacaoExemplo(extra: Json = {}): Json {
  return {
    numero: 1,
    escolha: "B",
    aderencia: 70,
    estilo: "orientacao",
    skills: ["gestao-os", "comunicacao-cliente"],
    alerta: null,
    contribuicao: null,
    justificativa: "Remarcou a OS, mas avisou o solicitante depois.",
    ...extra
  };
}

/** O turno 2 da documentação (sem o bloco `uso`). */
export function turnoDocumentado(): Json {
  return {
    tipo: "situacao",
    avaliacao_anterior: avaliacaoExemplo(),
    consequencia: "O solicitante soube pelo painel e ligou para o gerente do contrato.",
    situacao: {
      numero: 2,
      marco: false,
      estilo_adequado: "orientacao",
      texto:
        "O eletricista avisa que o disjuntor do setor B desarma sempre que o equipamento liga. " +
        "A manutenção programada para hoje depende dessa liberação. Faltam duas horas para o fim " +
        "do turno e a equipe está dividida entre este setor e outro chamado urgente.",
      opcoes: opcoesExemplo()
    },
    resultado: null
  };
}

/** A resposta de POST /teste/turnos para o turno 2: o turno com `uso` no mesmo nível. */
export function respostaTurnoExemplo(): Json {
  const turno = turnoDocumentado();
  return { ...turno, uso: usoExemplo() };
}

/** A resposta de POST /teste/sessoes: sessão opaca e a situação 1. */
export function respostaAberturaExemplo(): Json {
  const turno = respostaTurnoExemplo();
  return {
    sessao_id: "ses_9f3c2a71",
    tipo: "situacao",
    avaliacao_anterior: null,
    consequencia: null,
    situacao: { ...(turno.situacao as Json), numero: 1 },
    resultado: null,
    uso: usoExemplo()
  };
}

/** A resposta ao 5º turno: sem situação, com o resultado (sem números). */
export function respostaFinalExemplo(): Json {
  return {
    tipo: "resultado",
    avaliacao_anterior: avaliacaoExemplo({ numero: 5, escolha: "A", aderencia: 100 }),
    consequencia: "A equipe concluiu o turno com a OS registrada e o solicitante informado.",
    situacao: null,
    resultado: {
      resumo: "Você manteve o solicitante informado na maior parte do teste e priorizou bem as OS.",
      ponto_forte: "Comunicação com o solicitante quando havia mudança de prazo.",
      ponto_desenvolvimento: "Registrar as decisões no momento em que são tomadas.",
      sugestoes: [
        "Registre o aviso ao solicitante antes de remarcar.",
        "Revise o POP de remarcação."
      ],
      contribuicoes: ["Incluir o aviso ao solicitante no passo de remarcação da OS."]
    },
    uso: usoExemplo()
  };
}

/** Uma resposta da Guarda que mascara dados sensíveis. */
export function respostaGuardaExemplo(decisao: "seguir" | "mascarar" | "bloquear"): Json {
  return {
    decisao,
    texto: decisao === "mascarar" ? "Chamaria o eletricista [NOME] para ajudar." : null,
    uso: usoExemplo("guarda")
  };
}
