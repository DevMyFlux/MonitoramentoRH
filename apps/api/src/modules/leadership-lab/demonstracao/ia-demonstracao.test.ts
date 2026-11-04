import { type LabEscolha, type LabEstilo, labEscolhas, labSkillsPiloto } from "@my-flux/shared";
import { describe, expect, it } from "vitest";
import { aplicarGuarda, validarAberturaIa, validarTurnoIa } from "../ia/ia-contrato.js";
import { LIMITE_PALAVRAS_SITUACAO } from "../ia/ia-contrato.js";
import { PREFIXO_DA_DEMONSTRACAO, situacoesDeDemonstracao } from "./conteudo.js";
import { IaDemonstracao, SessaoDeDemonstracaoInvalida } from "./ia-demonstracao.js";

const ORDEM_DOS_ESTILOS: readonly LabEstilo[] = ["direcao", "orientacao", "apoio", "delegacao"];
const NOTA_PELA_DISTANCIA = [100, 70, 40, 10] as const;
const TOTAL = situacoesDeDemonstracao.length;

const corpoDeAbertura = {
  molde: "supervisor",
  temas: ["Prioridade de OS"],
  numero_situacoes: TOTAL
} as const;

describe("conteúdo de demonstração", () => {
  it("são cinco situações, cada uma com as opções A, B e C", () => {
    expect(TOTAL).toBe(5);
    for (const situacao of situacoesDeDemonstracao) {
      expect(Object.keys(situacao.opcoes).sort()).toEqual([...labEscolhas]);
    }
  });

  it("nenhuma situação passa do limite de palavras (nem com o prefixo), então o contrato não dá aviso", () => {
    for (const situacao of situacoesDeDemonstracao) {
      const palavras = `${PREFIXO_DA_DEMONSTRACAO}${situacao.texto}`.split(/\s+/).length;
      expect(palavras).toBeLessThanOrEqual(LIMITE_PALAVRAS_SITUACAO);
    }
  });

  it("a nota segue a convenção: distância do estilo adequado na ordem direção, orientação, apoio, delegação", () => {
    for (const situacao of situacoesDeDemonstracao) {
      for (const letra of labEscolhas) {
        const opcao = situacao.opcoes[letra];
        if (opcao.estilo === null) continue;
        const distancia = Math.abs(
          ORDEM_DOS_ESTILOS.indexOf(opcao.estilo) -
            ORDEM_DOS_ESTILOS.indexOf(situacao.estiloAdequado)
        );
        expect(opcao.aderencia, `${situacao.texto.slice(0, 30)}… ${letra}`).toBe(
          NOTA_PELA_DISTANCIA[distancia]
        );
      }
    }
  });

  it("as três opções de cada situação valem notas diferentes e há sempre uma resposta de 100", () => {
    for (const situacao of situacoesDeDemonstracao) {
      const notas = labEscolhas.map((letra) => situacao.opcoes[letra].aderencia);
      expect(new Set(notas).size).toBe(3);
      expect(notas).toContain(100);
    }
  });

  it("a melhor resposta não é sempre a mesma letra", () => {
    const melhores = situacoesDeDemonstracao.map((s) =>
      labEscolhas.find((letra) => s.opcoes[letra].aderencia === 100)
    );
    expect(new Set(melhores).size).toBeGreaterThanOrEqual(3);
  });

  it("só uma opção do teste inteiro gera o alerta vermelho (nota 10), na situação 4", () => {
    const vermelhas = situacoesDeDemonstracao.flatMap((s, i) =>
      labEscolhas
        .filter((letra) => s.opcoes[letra].aderencia === 10)
        .map((letra) => `${i + 1}${letra}`)
    );
    expect(vermelhas).toEqual(["4C"]);
  });

  it("as skills são do piloto, sem repetição, e toda opção avalia ao menos uma", () => {
    const ids = new Set<string>(labSkillsPiloto.map((s) => s.id));
    for (const situacao of situacoesDeDemonstracao) {
      expect(new Set(situacao.skillsEmJogo).size).toBe(situacao.skillsEmJogo.length);
      for (const skill of situacao.skillsEmJogo) expect(ids.has(skill)).toBe(true);
      for (const letra of labEscolhas) {
        const { skills } = situacao.opcoes[letra];
        expect(skills.length).toBeGreaterThan(0);
        expect(new Set(skills).size).toBe(skills.length);
        for (const skill of skills) expect(ids.has(skill)).toBe(true);
      }
    }
  });
});

describe("IaDemonstracao obedece ao contrato do serviço de IA", () => {
  /** Uma partida inteira, validando cada resposta com os mesmos validadores que o motor usa. */
  async function jogar(escolhas: Array<LabEscolha | null>, ia = new IaDemonstracao()) {
    const abertura = await ia.abrirSessao(corpoDeAbertura);
    const aberta = validarAberturaIa(abertura);
    if (!aberta.ok) throw new Error(`abertura inválida: ${aberta.problemas.join("; ")}`);
    expect(aberta.avisos).toEqual([]);

    const respostas = [];
    for (const [i, escolha] of escolhas.entries()) {
      const numero = i + 1;
      const bruto = await ia.proximoTurno({
        sessao_id: aberta.valor.sessao_id,
        numero,
        escolha,
        tempo_esgotado: escolha === null,
        texto_livre: null
      });
      const turno = validarTurnoIa(bruto, { numero, escolha, totalSituacoes: TOTAL });
      if (!turno.ok) throw new Error(`turno ${numero} inválido: ${turno.problemas.join("; ")}`);
      expect(turno.avisos).toEqual([]);
      respostas.push(turno.valor);
    }
    return { aberta: aberta.valor, respostas };
  }

  it("todos os 243 caminhos de A, B e C são aceitos pelo validador, e só o último turno traz o resultado", async () => {
    let caminhos = 0;
    for (let n = 0; n < 3 ** TOTAL; n++) {
      const escolhas = Array.from(
        { length: TOTAL },
        (_, i) => labEscolhas[Math.floor(n / 3 ** i) % 3] as LabEscolha
      );
      const { respostas } = await jogar(escolhas);
      expect(respostas.map((r) => r.tipo)).toEqual([
        ...Array<string>(TOTAL - 1).fill("situacao"),
        "resultado"
      ]);
      caminhos++;
    }
    expect(caminhos).toBe(243);
  });

  it("tempo esgotado em qualquer situação é uma omissão válida: aderência 0, sem escolha, skills da situação", async () => {
    for (let omitida = 0; omitida < TOTAL; omitida++) {
      const escolhas: Array<LabEscolha | null> = Array(TOTAL).fill("A");
      escolhas[omitida] = null;
      const { respostas } = await jogar(escolhas);
      const avaliacao = respostas[omitida]?.avaliacao_anterior;
      expect(avaliacao).toMatchObject({ escolha: null, aderencia: 0, estilo: null, alerta: null });
      expect(avaliacao?.skills).toEqual([
        ...(situacoesDeDemonstracao[omitida]?.skillsEmJogo ?? [])
      ]);
    }
  });

  it("a avaliação reflete a opção escolhida (nota, estilo, skills, alerta vermelho só com nota 10)", async () => {
    const { respostas } = await jogar(["A", "C", "B", "C", "C"]);
    const avaliacoes = respostas.map((r) => r.avaliacao_anterior);
    expect(avaliacoes.map((a) => a?.aderencia)).toEqual([100, 100, 100, 10, 100]);
    expect(avaliacoes.map((a) => a?.alerta)).toEqual([null, null, null, "vermelho", null]);
    expect(avaliacoes[3]?.skills).toEqual(["aplicacao-nr-pop", "decisao-pressao"]);
  });

  it("toda situação mostrada traz o prefixo (Demonstração), e o marco é a 3", async () => {
    const { aberta, respostas } = await jogar(["A", "A", "A", "A", "A"]);
    const situacoes = [
      aberta.situacao,
      ...respostas.flatMap((r) => (r.situacao ? [r.situacao] : []))
    ];
    expect(situacoes).toHaveLength(TOTAL);
    for (const s of situacoes) {
      expect(s.texto.startsWith(PREFIXO_DA_DEMONSTRACAO)).toBe(true);
      expect(s.marco).toBe(s.numero === 3);
    }
  });

  it("o resultado é claro sobre ser de demonstração e não traz número nenhum", async () => {
    const { respostas } = await jogar(["A", "A", "A", "A", "A"]);
    const final = respostas.at(-1);
    expect(final?.tipo).toBe("resultado");
    const texto = JSON.stringify(final?.tipo === "resultado" ? final.resultado : null);
    expect(texto).toContain("demonstração");
    expect(texto).not.toMatch(/\d/);
  });

  it("continua certo se outra instância atender a próxima chamada (nenhum estado em memória)", async () => {
    const primeira = new IaDemonstracao();
    const abertura = validarAberturaIa(await primeira.abrirSessao(corpoDeAbertura));
    if (!abertura.ok) throw new Error("abertura inválida");

    const segunda = new IaDemonstracao();
    const bruto = await segunda.proximoTurno({
      sessao_id: abertura.valor.sessao_id,
      numero: 1,
      escolha: "B",
      tempo_esgotado: false,
      texto_livre: null
    });
    expect(validarTurnoIa(bruto, { numero: 1, escolha: "B", totalSituacoes: TOTAL }).ok).toBe(true);
  });

  it("cada abertura gera uma sessão diferente", async () => {
    const ia = new IaDemonstracao();
    const a = validarAberturaIa(await ia.abrirSessao(corpoDeAbertura));
    const b = validarAberturaIa(await ia.abrirSessao(corpoDeAbertura));
    expect(a.ok && b.ok && a.valor.sessao_id !== b.valor.sessao_id).toBe(true);
  });

  it.each(["", "xyz", "demo", "demo.5", "demo.0.abc", "demo.11.abc", "demo.x.abc", "ses_falsa_1"])(
    "recusa o identificador de sessão %j",
    async (sessaoId) => {
      await expect(
        new IaDemonstracao().proximoTurno({
          sessao_id: sessaoId === "" ? "x" : sessaoId,
          numero: 1,
          escolha: "A",
          tempo_esgotado: false,
          texto_livre: null
        })
      ).rejects.toBeInstanceOf(SessaoDeDemonstracaoInvalida);
    }
  );

  it("usa os mesmos schemas estritos: um campo a mais (dado pessoal) derruba a chamada", async () => {
    const ia = new IaDemonstracao();
    await expect(ia.abrirSessao({ ...corpoDeAbertura, nome: "Maria" })).rejects.toThrow();
    await expect(ia.guarda({ texto: "oi", email: "a@b.c" })).rejects.toThrow();
  });

  it("a Guarda segue como está, e a resposta é válida para o contrato", async () => {
    const bruto = await new IaDemonstracao().guarda({ texto: "Chamaria o eletricista." });
    const aplicada = aplicarGuarda("Chamaria o eletricista.", bruto);
    expect(aplicada.respostaValida).toBe(true);
    expect(aplicada.decisao).toBe("seguir");
  });

  it("o texto livre é ignorado: nunca vira contribuição para o curador", async () => {
    const ia = new IaDemonstracao();
    const abertura = validarAberturaIa(await ia.abrirSessao(corpoDeAbertura));
    if (!abertura.ok) throw new Error("abertura inválida");
    const bruto = await ia.proximoTurno({
      sessao_id: abertura.valor.sessao_id,
      numero: 1,
      escolha: "A",
      tempo_esgotado: false,
      texto_livre: "SEGREDO-DO-TEXTO-LIVRE: ligaria para o fornecedor."
    });
    const turno = validarTurnoIa(bruto, { numero: 1, escolha: "A", totalSituacoes: TOTAL });
    expect(turno.ok && turno.valor.avaliacao_anterior?.contribuicao).toBeNull();
    expect(JSON.stringify(bruto)).not.toContain("SEGREDO-DO-TEXTO-LIVRE");
  });
});
