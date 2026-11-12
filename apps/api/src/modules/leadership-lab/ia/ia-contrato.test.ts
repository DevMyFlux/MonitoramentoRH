import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Json,
  avaliacaoExemplo,
  respostaAberturaExemplo,
  respostaFinalExemplo,
  respostaGuardaExemplo,
  respostaTurnoExemplo,
  turnoDocumentado,
  usoExemplo
} from "./ia-exemplos.js";
import {
  LIMITE_PALAVRAS_SITUACAO,
  aplicarGuarda,
  conversaIaRequestSchema,
  guardaIaRequestSchema,
  iniciarSessaoIaRequestSchema,
  proximoTurnoIaRequestSchema,
  turnoIaSchema,
  validarAberturaIa,
  validarConversaIa,
  validarTurnoIa
} from "./ia-contrato.js";

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

type Raiz = Record<string, unknown>;

/** Devolve uma cópia de `base` com o valor de `caminho` ("a.b.0.c") trocado. */
function com(base: Json, caminho: string, valor: unknown): Json {
  const copia = structuredClone(base);
  const partes = caminho.split(".");
  const ultimo = partes.pop() as string;
  let atual = copia as Raiz;
  for (const parte of partes) atual = atual[parte] as Raiz;
  atual[ultimo] = valor;
  return copia;
}

/** Devolve uma cópia de `base` sem a chave em `caminho`. */
function sem(base: Json, caminho: string): Json {
  const copia = structuredClone(base);
  const partes = caminho.split(".");
  const ultimo = partes.pop() as string;
  let atual = copia as Raiz;
  for (const parte of partes) atual = atual[parte] as Raiz;
  delete atual[ultimo];
  return copia;
}

/** Os caminhos de todas as chaves de objeto e de todas as folhas de um valor JSON. */
function percorrer(valor: unknown, prefixo: string[] = []) {
  const objetos: string[][] = [];
  const chaves: string[][] = [];
  const folhas: string[][] = [];
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => {
      const filho = percorrer(item, [...prefixo, String(i)]);
      objetos.push(...filho.objetos);
      chaves.push(...filho.chaves);
      folhas.push(...filho.folhas);
    });
  } else if (valor !== null && typeof valor === "object") {
    objetos.push(prefixo);
    for (const [chave, filho] of Object.entries(valor)) {
      chaves.push([...prefixo, chave]);
      const sub = percorrer(filho, [...prefixo, chave]);
      objetos.push(...sub.objetos);
      chaves.push(...sub.chaves);
      folhas.push(...sub.folhas);
    }
  } else {
    folhas.push(prefixo);
  }
  return { objetos, chaves, folhas };
}

function palavras(n: number): string {
  return Array.from({ length: n }, (_, i) => `palavra${i}`).join(" ");
}

const esperadoApos1 = { numero: 1, escolha: "B", totalSituacoes: 5 } as const;

function problemasDe(r: { ok: boolean } & Record<string, unknown>): string {
  expect(r.ok).toBe(false);
  return (r.problemas as string[]).join(" | ");
}

// ---------------------------------------------------------------------------
// O JSON do turno, como na documentação
// ---------------------------------------------------------------------------

describe("turnoIaSchema (JSON da documentação)", () => {
  it("aceita o turno da documentação", () => {
    const lido = turnoIaSchema.safeParse(turnoDocumentado());
    expect(lido.success).toBe(true);
  });

  it("aceita o último turno: tipo resultado, situação nula, sem números", () => {
    const { uso: _uso, ...ultimo } = respostaFinalExemplo();
    void _uso;
    expect(turnoIaSchema.safeParse(ultimo).success).toBe(true);
  });

  it("apara espaços dos textos", () => {
    const lido = turnoIaSchema.parse(
      com(turnoDocumentado(), "consequencia", "  Efeito da escolha.  ")
    );
    expect(lido.consequencia).toBe("Efeito da escolha.");
  });
});

describe("regras do jogo no turno", () => {
  const base = respostaTurnoExemplo();
  const validar = (bruto: Json) => validarTurnoIa(bruto, esperadoApos1);

  it("a resposta base é válida", () => {
    expect(validar(base)).toMatchObject({ ok: true, avisos: [] });
  });

  it.each([
    [
      "duas opções",
      com(base, "situacao.opcoes", [
        { id: "A", texto: "a" },
        { id: "B", texto: "b" }
      ]),
      "situacao.opcoes"
    ],
    [
      "quatro opções",
      com(base, "situacao.opcoes", [
        { id: "A", texto: "a" },
        { id: "B", texto: "b" },
        { id: "C", texto: "c" },
        { id: "D", texto: "d" }
      ]),
      "situacao.opcoes"
    ],
    ["opções fora de ordem", com(base, "situacao.opcoes.0.id", "B"), "situacao.opcoes[0].id"],
    ["opção sem texto", com(base, "situacao.opcoes.1.texto", "   "), "situacao.opcoes[1].texto"],
    [
      "aderência fora da escala",
      com(base, "avaliacao_anterior.aderencia", 55),
      "avaliacao_anterior.aderencia"
    ],
    [
      "aderência como texto",
      com(base, "avaliacao_anterior.aderencia", "70"),
      "avaliacao_anterior.aderencia"
    ],
    [
      "aderência 0 com escolha",
      com(base, "avaliacao_anterior.aderencia", 0),
      "só existe quando o tempo esgotou"
    ],
    [
      "sem escolha mas com aderência",
      com(base, "avaliacao_anterior.escolha", null),
      "sem escolha (tempo esgotado) a aderência é 0"
    ],
    [
      "alerta vermelho com aderência 70",
      com(base, "avaliacao_anterior.alerta", "vermelho"),
      "alerta vermelho só com aderência 10"
    ],
    [
      "aderência 10 sem alerta vermelho",
      com(base, "avaliacao_anterior.aderencia", 10),
      "aderência 10 exige alerta vermelho"
    ],
    [
      "alerta amarelo vindo da IA",
      com(base, "avaliacao_anterior.alerta", "amarelo"),
      "avaliacao_anterior.alerta"
    ],
    [
      "estilo desconhecido",
      com(base, "avaliacao_anterior.estilo", "autocratico"),
      "avaliacao_anterior.estilo"
    ],
    [
      "estilo adequado desconhecido",
      com(base, "situacao.estilo_adequado", "x"),
      "situacao.estilo_adequado"
    ],
    [
      "escolha desconhecida",
      com(base, "avaliacao_anterior.escolha", "D"),
      "avaliacao_anterior.escolha"
    ],
    [
      "skill inventada",
      com(base, "avaliacao_anterior.skills", ["gestao-os", "telepatia"]),
      "avaliacao_anterior.skills[1]"
    ],
    [
      "skill repetida",
      com(base, "avaliacao_anterior.skills", ["gestao-os", "gestao-os"]),
      "skills repetidas"
    ],
    ["marco na situação 2", com(base, "situacao.marco", true), "o marco é a situação 3"],
    [
      "justificativa vazia",
      com(base, "avaliacao_anterior.justificativa", ""),
      "avaliacao_anterior.justificativa"
    ],
    ["texto da situação vazio", com(base, "situacao.texto", " "), "situacao.texto"],
    ["número da situação 0", com(base, "situacao.numero", 0), "situacao.numero"],
    ["número da situação 11", com(base, "situacao.numero", 11), "situacao.numero"]
  ])("rejeita %s", (_nome, bruto, trecho) => {
    expect(problemasDe(validar(bruto))).toContain(trecho);
  });

  it("a situação 3 é o marco e tem de dizer que é", () => {
    const tres = com(
      com(com(base, "situacao.numero", 3), "avaliacao_anterior.numero", 2),
      "situacao.marco",
      false
    );
    const r = validarTurnoIa(tres, { numero: 2, escolha: "B", totalSituacoes: 5 });
    expect(problemasDe(r)).toContain("o marco é a situação 3");
    const certo = com(tres, "situacao.marco", true);
    expect(validarTurnoIa(certo, { numero: 2, escolha: "B", totalSituacoes: 5 }).ok).toBe(true);
  });

  it("aceita o alerta vermelho coerente: aderência 10 e alerta juntos", () => {
    const vermelho = com(
      com(base, "avaliacao_anterior.aderencia", 10),
      "avaliacao_anterior.alerta",
      "vermelho"
    );
    expect(validar(vermelho).ok).toBe(true);
  });

  it("aceita a omissão: sem escolha, aderência 0, sem alerta", () => {
    const omissao = com(
      com(base, "avaliacao_anterior.escolha", null),
      "avaliacao_anterior.aderencia",
      0
    );
    expect(validarTurnoIa(omissao, { numero: 1, escolha: null, totalSituacoes: 5 }).ok).toBe(true);
  });

  describe("sequência da conversa", () => {
    it("depois da primeira situação, avaliação e consequência são obrigatórias", () => {
      expect(problemasDe(validar(com(base, "avaliacao_anterior", null)))).toContain(
        "obrigatória a partir da segunda situação"
      );
      expect(problemasDe(validar(com(base, "consequencia", null)))).toContain("consequencia");
    });

    it("a avaliação deve ser da situação imediatamente anterior", () => {
      expect(problemasDe(validar(com(base, "avaliacao_anterior.numero", 2)))).toContain(
        "deve avaliar a situação anterior (1)"
      );
    });
  });

  describe("formato estrito", () => {
    it.each([
      ["campo extra no topo (nota)", com(base, "nota", 70), "nota"],
      ["campo extra na avaliação (tempo)", com(base, "avaliacao_anterior.tempo", 12), "tempo"],
      ["campo extra na situação", com(base, "situacao.dica", "A"), "dica"],
      ["campo extra numa opção (correta)", com(base, "situacao.opcoes.0.correta", true), "correta"],
      ["campo extra no uso", com(base, "uso.prompt", "x"), "prompt"],
      ["sem consequencia", sem(base, "consequencia"), "consequencia"],
      ["sem resultado (a chave deve existir, nula)", sem(base, "resultado"), "resultado"],
      ["sem uso", sem(base, "uso"), "uso"],
      ["tipo desconhecido", com(base, "tipo", "pergunta"), "tipo"],
      [
        "tipo situacao com resultado preenchido",
        com(base, "resultado", respostaFinalExemplo().resultado),
        "resultado"
      ],
      ["uso de outro agente", com(base, "uso.agente", "guarda"), "uso.agente"],
      ["tokens negativos", com(base, "uso.tokens_saida", -1), "uso.tokens_saida"]
    ])("rejeita %s", (_nome, bruto, trecho) => {
      expect(problemasDe(validar(bruto))).toContain(trecho);
    });

    it.each([null, undefined, "texto", 42, [], true, {}])("rejeita %j sem lançar", (lixo) => {
      expect(validar(lixo as Json).ok).toBe(false);
    });
  });
});

describe("o último turno (resultado)", () => {
  const final = respostaFinalExemplo();
  const esperadoFinal = { numero: 5, escolha: "A", totalSituacoes: 5 } as const;

  it("a resposta final é válida", () => {
    expect(validarTurnoIa(final, esperadoFinal)).toMatchObject({ ok: true });
  });

  it.each([
    [
      "número no resultado (a IA não calcula)",
      com(final, "resultado.aderencia_geral", 80),
      "aderencia_geral"
    ],
    ["agilidade no resultado", com(final, "resultado.agilidade", 50), "agilidade"],
    ["níveis no resultado", com(final, "resultado.niveis", { "gestao-os": 4 }), "niveis"],
    ["resultado sem ponto forte", sem(final, "resultado.ponto_forte"), "resultado.ponto_forte"],
    ["resumo vazio", com(final, "resultado.resumo", ""), "resultado.resumo"],
    ["sugestão vazia", com(final, "resultado.sugestoes", ["ok", " "]), "resultado.sugestoes[1]"],
    [
      "situação preenchida no turno final",
      com(final, "situacao", respostaTurnoExemplo().situacao),
      "situacao"
    ],
    ["resultado nulo no turno final", com(final, "resultado", null), "resultado"],
    [
      "sem avaliação da última escolha",
      com(final, "avaliacao_anterior", null),
      "avaliacao_anterior"
    ]
  ])("rejeita %s", (_nome, bruto, trecho) => {
    expect(problemasDe(validarTurnoIa(bruto, esperadoFinal))).toContain(trecho);
  });

  it("aceita sugestões e contribuições vazias", () => {
    const vazio = com(com(final, "resultado.sugestoes", []), "resultado.contribuicoes", []);
    expect(validarTurnoIa(vazio, esperadoFinal).ok).toBe(true);
  });
});

describe("abertura da sessão", () => {
  const abertura = respostaAberturaExemplo();

  it("aceita a situação 1 com o identificador opaco da conversa", () => {
    const r = validarAberturaIa(abertura);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.valor.sessao_id).toBe("ses_9f3c2a71");
  });

  it.each([
    ["sem sessao_id", sem(abertura, "sessao_id"), "sessao_id"],
    ["sessao_id vazio", com(abertura, "sessao_id", ""), "sessao_id"],
    [
      "com avaliação anterior",
      com(abertura, "avaliacao_anterior", avaliacaoExemplo()),
      "a primeira situação não avalia nada anterior"
    ],
    [
      "com consequência",
      com(abertura, "consequencia", "Algo."),
      "a primeira situação não tem consequência anterior"
    ],
    [
      "começando na situação 2",
      com(abertura, "situacao.numero", 2),
      "a abertura deve trazer a situação 1"
    ],
    ["devolvendo resultado", com(abertura, "tipo", "resultado"), "tipo"]
  ])("rejeita %s", (_nome, bruto, trecho) => {
    expect(problemasDe(validarAberturaIa(bruto))).toContain(trecho);
  });

  it.each([null, undefined, "x", [], 7])("rejeita %j sem lançar", (lixo) => {
    expect(validarAberturaIa(lixo).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A IA não pode desviar a conversa
// ---------------------------------------------------------------------------

describe("validarTurnoIa contra o que o backend esperava", () => {
  const turno = respostaTurnoExemplo(); // avalia a situação 1, escolha B, e traz a 2

  it("recusa que a IA avalie outra letra que não a enviada", () => {
    const r = validarTurnoIa(turno, { numero: 1, escolha: "C", totalSituacoes: 5 });
    expect(problemasDe(r)).toContain("avaliacao_anterior.escolha: esperado C, recebido B");
  });

  it("recusa que a IA avalie uma escolha quando houve tempo esgotado", () => {
    const r = validarTurnoIa(turno, { numero: 1, escolha: null, totalSituacoes: 5 });
    expect(problemasDe(r)).toContain("esperado nenhuma (tempo esgotado), recebido B");
  });

  it("recusa que a IA invente uma escolha ausente (omissão tratada como resposta)", () => {
    const comoOmissao = com(
      com(turno, "avaliacao_anterior.escolha", null),
      "avaliacao_anterior.aderencia",
      0
    );
    const r = validarTurnoIa(comoOmissao, { numero: 1, escolha: "B", totalSituacoes: 5 });
    expect(problemasDe(r)).toContain("esperado B, recebido nenhuma");
  });

  it("recusa que a IA avalie outra situação", () => {
    const r = validarTurnoIa(turno, { numero: 2, escolha: "B", totalSituacoes: 5 });
    expect(problemasDe(r)).toContain("avaliacao_anterior.numero: esperado 2, recebido 1");
  });

  it("recusa pular uma situação ou repetir a mesma", () => {
    const pulou = com(com(turno, "situacao.numero", 3), "avaliacao_anterior.numero", 2);
    const r = validarTurnoIa(com(pulou, "situacao.marco", true), esperadoApos1);
    expect(r.ok).toBe(false);
    const repetiu = validarTurnoIa(com(turno, "situacao.numero", 1), esperadoApos1);
    // Repetir a situação 1 depois de respondê-la cai na regra da abertura.
    expect(problemasDe(repetiu)).toContain("a primeira situação não avalia nada anterior");
  });

  it("recusa encerrar o teste antes da hora", () => {
    const r = validarTurnoIa(respostaFinalExemplo(), {
      numero: 4,
      escolha: "A",
      totalSituacoes: 5
    });
    expect(problemasDe(r)).toContain("'resultado' é prematuro");
  });

  it("recusa prolongar o teste depois da última situação", () => {
    const r = validarTurnoIa(
      com(com(turno, "situacao.numero", 6), "avaliacao_anterior.numero", 5),
      { numero: 5, escolha: "B", totalSituacoes: 5 }
    );
    expect(problemasDe(r)).toContain("deve ser 'resultado'");
  });

  it("aceita a sequência completa de 1 a 5", () => {
    for (let n = 1; n <= 4; n++) {
      const resposta = com(
        com(com(turno, "situacao.numero", n + 1), "avaliacao_anterior.numero", n),
        "situacao.marco",
        n + 1 === 3
      );
      expect(
        validarTurnoIa(resposta, { numero: n, escolha: "B", totalSituacoes: 5 }).ok,
        `turno ${n}`
      ).toBe(true);
    }
    expect(
      validarTurnoIa(respostaFinalExemplo(), { numero: 5, escolha: "A", totalSituacoes: 5 }).ok
    ).toBe(true);
  });

  it("lança Error, e só então, se o estado esperado for incoerente (defeito de quem chama)", () => {
    for (const esperado of [
      { numero: 0, escolha: "A", totalSituacoes: 5 },
      { numero: 6, escolha: "A", totalSituacoes: 5 },
      { numero: 1.5, escolha: "A", totalSituacoes: 5 },
      { numero: 1, escolha: "A", totalSituacoes: Number.NaN }
    ] as const) {
      expect(() => validarTurnoIa(turno, esperado)).toThrow(/incoerente/);
    }
  });
});

describe("avisos: orientações que não rejeitam a resposta", () => {
  const comTexto = (n: number) => com(respostaTurnoExemplo(), "situacao.texto", palavras(n));

  it(`situação com até ${LIMITE_PALAVRAS_SITUACAO} palavras não gera aviso`, () => {
    expect(validarTurnoIa(comTexto(LIMITE_PALAVRAS_SITUACAO), esperadoApos1)).toMatchObject({
      ok: true,
      avisos: []
    });
  });

  it("situação mais longa é aceita, com aviso", () => {
    const r = validarTurnoIa(comTexto(LIMITE_PALAVRAS_SITUACAO + 1), esperadoApos1);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.avisos).toEqual([expect.stringContaining("61 palavras")]);
  });

  it("a abertura também avisa", () => {
    const r = validarAberturaIa(com(respostaAberturaExemplo(), "situacao.texto", palavras(80)));
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.avisos).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Todo campo é obrigatório, tipado e fechado: verificação sistemática
// ---------------------------------------------------------------------------

describe.each([
  ["abertura", () => respostaAberturaExemplo(), (b: unknown) => validarAberturaIa(b)],
  ["turno", () => respostaTurnoExemplo(), (b: unknown) => validarTurnoIa(b, esperadoApos1)],
  [
    "resultado",
    () => respostaFinalExemplo(),
    (b: unknown) => validarTurnoIa(b, { numero: 5, escolha: "A", totalSituacoes: 5 })
  ]
])("formato fechado: %s", (_nome, exemplo, validar) => {
  it("o exemplo é válido", () => {
    expect(validar(exemplo()).ok).toBe(true);
  });

  it("apagar qualquer chave de qualquer objeto é rejeitado", () => {
    const { chaves } = percorrer(exemplo());
    expect(chaves.length).toBeGreaterThan(20);
    for (const chave of chaves) {
      expect(validar(sem(exemplo(), chave.join("."))).ok, `sem ${chave.join(".")}`).toBe(false);
    }
  });

  it("trocar qualquer valor por um objeto é rejeitado", () => {
    const { folhas } = percorrer(exemplo());
    for (const folha of folhas) {
      expect(validar(com(exemplo(), folha.join("."), {})).ok, `{} em ${folha.join(".")}`).toBe(
        false
      );
    }
  });

  it("acrescentar um campo desconhecido a qualquer objeto é rejeitado", () => {
    const { objetos } = percorrer(exemplo());
    expect(objetos.length).toBeGreaterThan(3);
    for (const caminho of objetos) {
      const copia = exemplo();
      let alvo = copia as Raiz;
      for (const parte of caminho) alvo = alvo[parte] as Raiz;
      alvo.nome_do_participante = "x";
      expect(validar(copia).ok, `extra em ${caminho.join(".") || "(raiz)"}`).toBe(false);
    }
  });
});

describe("robustez: lixo nunca lança nem passa", () => {
  function gerador(semente: number) {
    let a = semente;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const chavesComuns = [
    "tipo",
    "situacao",
    "resultado",
    "uso",
    "decisao",
    "texto",
    "opcoes",
    "numero"
  ];

  function lixo(rnd: () => number, profundidade = 0): unknown {
    const sorteio = rnd();
    if (profundidade > 3 || sorteio < 0.3) {
      return [null, true, false, 0, -1, 1e9, "", "situacao", "A", "x".repeat(10), Number.NaN][
        Math.floor(rnd() * 11)
      ];
    }
    if (sorteio < 0.55)
      return Array.from({ length: Math.floor(rnd() * 4) }, () => lixo(rnd, profundidade + 1));
    const objeto: Record<string, unknown> = {};
    for (let i = Math.floor(rnd() * 6); i > 0; i--) {
      const chave =
        rnd() < 0.6
          ? chavesComuns[Math.floor(rnd() * chavesComuns.length)]!
          : `k${Math.floor(rnd() * 99)}`;
      objeto[chave] = lixo(rnd, profundidade + 1);
    }
    return objeto;
  }

  it("3000 valores aleatórios: nenhum lança e nenhum é aceito", () => {
    const rnd = gerador(7);
    for (let i = 0; i < 3000; i++) {
      const valor = lixo(rnd);
      expect(validarAberturaIa(valor).ok).toBe(false);
      expect(validarTurnoIa(valor, esperadoApos1).ok).toBe(false);
      expect(aplicarGuarda("texto", valor).decisao).toBe("bloquear");
    }
  });
});

// ---------------------------------------------------------------------------
// Guarda: falha fechada
// ---------------------------------------------------------------------------

describe("aplicarGuarda", () => {
  const original = "Eu chamaria o João da manutenção.";

  it("seguir: usa o texto que o próprio backend enviou, não o da IA", () => {
    expect(aplicarGuarda(original, respostaGuardaExemplo("seguir"))).toMatchObject({
      decisao: "seguir",
      texto: original,
      respostaValida: true,
      problemas: []
    });
  });

  it("mascarar: usa só o texto devolvido, nunca o original", () => {
    const r = aplicarGuarda(original, respostaGuardaExemplo("mascarar"));
    expect(r).toMatchObject({ decisao: "mascarar", respostaValida: true });
    expect(r.texto).toBe("Chamaria o eletricista [NOME] para ajudar.");
    expect(r.texto).not.toContain("João");
  });

  it("bloquear: nada do texto sobra", () => {
    expect(aplicarGuarda(original, respostaGuardaExemplo("bloquear"))).toMatchObject({
      decisao: "bloquear",
      texto: null,
      respostaValida: true
    });
  });

  it("devolve o bloco de uso para o log_ia", () => {
    expect(aplicarGuarda(original, respostaGuardaExemplo("seguir")).uso).toMatchObject({
      agente: "guarda"
    });
  });

  const g = (extra: Json) => ({ ...respostaGuardaExemplo("seguir"), ...extra });
  it.each([
    ["sem resposta (undefined)", undefined],
    ["resposta nula", null],
    ["texto solto", "bloquear"],
    ["objeto vazio", {}],
    ["decisão desconhecida", g({ decisao: "liberar" })],
    ["decisão em maiúsculas", g({ decisao: "SEGUIR" })],
    ["sem bloco uso", { decisao: "seguir", texto: null }],
    ["uso de outro agente", g({ uso: usoExemplo("agente_lab") })],
    ["seguir com texto (a IA tentando trocar o texto)", g({ texto: "Outro texto." })],
    [
      "bloquear devolvendo texto (vazamento)",
      { ...respostaGuardaExemplo("bloquear"), texto: original }
    ],
    ["mascarar sem texto", { ...respostaGuardaExemplo("mascarar"), texto: null }],
    ["mascarar com texto vazio", { ...respostaGuardaExemplo("mascarar"), texto: "  " }],
    ["campo extra", g({ motivo: "continha um nome" })],
    ["decisão como lista", g({ decisao: ["seguir"] })]
  ])("falha fechada: %s -> bloqueia", (_nome, bruto) => {
    const r = aplicarGuarda(original, bruto);
    expect(r).toMatchObject({
      decisao: "bloquear",
      texto: null,
      respostaValida: false,
      uso: null
    });
    expect(r.problemas.length).toBeGreaterThan(0);
  });

  it("só há texto quando a decisão é seguir ou mascarar (regra do banco)", () => {
    const respostas: unknown[] = [
      respostaGuardaExemplo("seguir"),
      respostaGuardaExemplo("mascarar"),
      respostaGuardaExemplo("bloquear"),
      undefined,
      {}
    ];
    for (const bruto of respostas) {
      const r = aplicarGuarda(original, bruto);
      if (r.texto !== null) expect(["seguir", "mascarar"]).toContain(r.decisao);
      if (r.decisao === "bloquear") expect(r.texto).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Requisições: lista fechada de campos que chegam à IA
// ---------------------------------------------------------------------------

describe("requisições para a IA", () => {
  const iniciar = { molde: "supervisor", temas: ["Prioridade de OS"], numero_situacoes: 5 };
  const proximo = {
    sessao_id: "ses_9f3c2a71",
    numero: 2,
    escolha: "C",
    tempo_esgotado: false,
    texto_livre: null
  };

  it("aceita os corpos válidos", () => {
    expect(iniciarSessaoIaRequestSchema.safeParse(iniciar).success).toBe(true);
    expect(proximoTurnoIaRequestSchema.safeParse(proximo).success).toBe(true);
    expect(guardaIaRequestSchema.safeParse({ texto: "Eu avisaria o gerente." }).success).toBe(true);
  });

  it("os campos que chegam à IA são exatamente estes (a lista fechada)", () => {
    expect(Object.keys(iniciarSessaoIaRequestSchema.shape).sort()).toEqual([
      "contexto",
      "molde",
      "numero_situacoes",
      "temas"
    ]);
    expect(Object.keys(proximoTurnoIaRequestSchema.shape).sort()).toEqual([
      "escolha",
      "numero",
      "sessao_id",
      "tempo_esgotado",
      "texto_livre"
    ]);
    expect(Object.keys(guardaIaRequestSchema.shape)).toEqual(["texto"]);
  });

  const dadosQueNaoPodemChegar = [
    "nome",
    "name",
    "matricula",
    "identifier",
    "email",
    "cpf",
    "unidade",
    "unit",
    "operation",
    "operationId",
    "employeeId",
    "userId",
    "user_id",
    "participante_id",
    "cargo",
    "aderencia",
    "nota"
  ];

  it.each([
    ["iniciar sessão", iniciar, iniciarSessaoIaRequestSchema],
    ["próximo turno", proximo, proximoTurnoIaRequestSchema],
    ["Guarda", { texto: "ok" }, guardaIaRequestSchema]
  ] as const)(
    "%s: dado pessoal ou nota não passam, mesmo disfarçados de campo",
    (_nome, corpo, schema) => {
      for (const campo of dadosQueNaoPodemChegar) {
        expect(schema.safeParse({ ...corpo, [campo]: "valor" }).success, campo).toBe(false);
      }
    }
  );

  it("a saída do parse só contém campos da lista (é o que se envia)", () => {
    const enviado = proximoTurnoIaRequestSchema.parse(proximo);
    expect(Object.keys(enviado).sort()).toEqual(Object.keys(proximo).sort());
  });

  it.each([
    ["molde desconhecido", { ...iniciar, molde: "diretor" }],
    ["sem temas", { ...iniciar, temas: [] }],
    ["tema vazio", { ...iniciar, temas: [" "] }],
    ["menos de 3 situações", { ...iniciar, numero_situacoes: 2 }],
    ["mais de 10 situações", { ...iniciar, numero_situacoes: 11 }]
  ])("iniciar sessão rejeita %s", (_nome, corpo) => {
    expect(iniciarSessaoIaRequestSchema.safeParse(corpo).success).toBe(false);
  });

  it("próximo turno: tempo esgotado e ausência de escolha andam juntos", () => {
    const omissao = { ...proximo, escolha: null, tempo_esgotado: true };
    expect(proximoTurnoIaRequestSchema.safeParse(omissao).success).toBe(true);
    expect(
      proximoTurnoIaRequestSchema.safeParse({ ...proximo, tempo_esgotado: true }).success
    ).toBe(false);
    expect(proximoTurnoIaRequestSchema.safeParse({ ...proximo, escolha: null }).success).toBe(
      false
    );
  });

  it("próximo turno: o campo livre só existe depois de responder", () => {
    const omissaoComTexto = { ...proximo, escolha: null, tempo_esgotado: true, texto_livre: "x" };
    expect(proximoTurnoIaRequestSchema.safeParse(omissaoComTexto).success).toBe(false);
    expect(
      proximoTurnoIaRequestSchema.safeParse({ ...proximo, texto_livre: "Chamaria o gerente." })
        .success
    ).toBe(true);
  });

  it("próximo turno: texto em branco não é texto (deve ser null)", () => {
    expect(proximoTurnoIaRequestSchema.safeParse({ ...proximo, texto_livre: "   " }).success).toBe(
      false
    );
    expect(guardaIaRequestSchema.safeParse({ texto: "  " }).success).toBe(false);
  });
});

describe("conversa com o facilitador", () => {
  const resultado = {
    resumo: "Você conduziu o turno.",
    ponto_forte: "Comunicação.",
    ponto_desenvolvimento: null,
    sugestoes: ["Registre o aviso."],
    skills: [{ skill: "gestao-os", nivel: 4 }],
    situacoes: [
      {
        numero: 1,
        marco: false,
        texto: "Cenário.",
        opcoes: [
          { id: "A", texto: "a" },
          { id: "B", texto: "b" },
          { id: "C", texto: "c" }
        ],
        escolha: "A",
        tempo_esgotado: false,
        justificativa: "Boa."
      }
    ]
  };
  const pedido = {
    modo: "debriefing",
    contexto: null,
    molde: "supervisor",
    mensagem: "Como fui?",
    historico: [],
    resultado
  };

  it("o pedido é uma lista fechada de campos: nome, aderência e ids não passam", () => {
    expect(conversaIaRequestSchema.safeParse(pedido).success).toBe(true);
    for (const extra of [{ nome: "Ana" }, { aderencia: 100 }, { participante_id: "x" }]) {
      expect(conversaIaRequestSchema.safeParse({ ...pedido, ...extra }).success).toBe(false);
    }
    expect(
      conversaIaRequestSchema.safeParse({
        ...pedido,
        resultado: {
          ...resultado,
          situacoes: [{ ...resultado.situacoes[0], aderencia: 100 }]
        }
      }).success
    ).toBe(false);
  });

  it("respeita os limites: mensagem, histórico e papéis", () => {
    expect(
      conversaIaRequestSchema.safeParse({ ...pedido, mensagem: "x".repeat(501) }).success
    ).toBe(false);
    const msg = { papel: "participante", texto: "oi" };
    expect(
      conversaIaRequestSchema.safeParse({ ...pedido, historico: Array(7).fill(msg) }).success
    ).toBe(false);
    expect(
      conversaIaRequestSchema.safeParse({
        ...pedido,
        historico: [{ papel: "sistema", texto: "oi" }]
      }).success
    ).toBe(false);
  });

  it("a resposta precisa de texto e do bloco uso do facilitador", () => {
    const uso = {
      agente: "facilitador",
      modelo: "m",
      versao_instrucao: "1",
      tokens_entrada: 1,
      tokens_saida: 1
    };
    const ok = { resposta: "Olá.", fontes: [], uso };
    expect(validarConversaIa(ok).ok).toBe(true);
    expect(validarConversaIa({ ...ok, resposta: "  " }).ok).toBe(false);
    expect(validarConversaIa({ ...ok, uso: { ...uso, agente: "guarda" } }).ok).toBe(false);
    expect(validarConversaIa({ ...ok, aderencia: 100 }).ok).toBe(false);
    expect(validarConversaIa({ resposta: "Olá.", uso }).ok).toBe(false); // fontes é obrigatório
    expect(validarConversaIa(null).ok).toBe(false);
  });
});

describe("paridade com o serviço Python (services/lab-ia/tests/fixtures)", () => {
  // Os mesmos arquivos são lidos por tests/simular_facilitador.py: se um lado mudar o formato, o
  // outro teste reprova.
  const lerFixture = (nome: string): unknown =>
    JSON.parse(
      readFileSync(
        new URL(`../../../../../../services/lab-ia/tests/fixtures/${nome}`, import.meta.url),
        "utf8"
      )
    );

  it("o pedido que o serviço aceita é um pedido válido para o backend", () => {
    expect(conversaIaRequestSchema.safeParse(lerFixture("conversa-pedido.json")).success).toBe(
      true
    );
  });

  it("a resposta que o serviço devolve passa na validação do backend", () => {
    const r = validarConversaIa(lerFixture("conversa-resposta.json"));
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });
});
