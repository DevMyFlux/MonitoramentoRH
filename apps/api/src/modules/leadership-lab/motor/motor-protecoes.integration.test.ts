// Motor do teste: as proteções. Guarda do campo livre, falhas da IA, requisições simultâneas,
// pré-condições, permissões e dado pessoal. PostgreSQL real e IA falsa; exige
// LAB_TEST_DATABASE_URL (sem ela, é ignorado).
import type { LabAtor } from "@my-flux/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../db/test-database.js";
import { criarUsuario, inserir } from "../db/test-fixtures.js";
import { respostaFinalExemplo } from "../ia/ia-exemplos.js";
import {
  type Banco,
  type Cenario,
  encerrarBanco,
  esperarAte,
  jogar,
  novoCenario,
  prepararBanco
} from "./cenario-de-teste.js";
import type { RespostaDeSituacao, RespostaDoTeste } from "./visoes.js";

function situacao(r: RespostaDoTeste): RespostaDeSituacao {
  if (r.tipo !== "situacao") throw new Error("era esperada uma situação");
  return r;
}

describe.skipIf(!integrationEnabled)("motor do teste: proteções", () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await prepararBanco();
  }, 60_000);

  afterAll(async () => {
    await encerrarBanco(banco);
  });

  const consulta = (sql: string, params: unknown[] = []) =>
    banco.db.client.query(sql, params).then((r) => r.rows);

  /** Um teste aberto com 10 s já passados na situação 1. */
  async function aberto(opcoes?: Parameters<typeof novoCenario>[1]) {
    const c = await novoCenario(banco, opcoes);
    const { sessaoId } = situacao(await c.motor.iniciar(c.ator));
    c.relogio.avancar(10_000);
    return { c, sessaoId };
  }
  const turno1 = (sessaoId: string) =>
    consulta(
      `SELECT escolha, tempo_resposta_ms, texto_livre, decisao_guarda, justificativa, processando_ate
         FROM leadership_lab.turno WHERE sessao_id = $1 AND numero = 1`,
      [sessaoId]
    ).then((l) => l[0]);
  const contar = (sql: string, params: unknown[]) =>
    consulta(sql, params).then((l) => Number(l[0]?.n));

  // =========================================================================
  describe("campo livre e Guarda", () => {
    const original = "Eu chamaria o eletricista João Silva, matrícula 4521, com urgência.";

    it("seguir: o texto segue como está, para a IA e para o banco", async () => {
      const { c, sessaoId } = await aberto();
      c.ia.decisaoDaGuarda = "seguir";
      await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B", textoLivre: original });

      expect(await turno1(sessaoId)).toMatchObject({
        texto_livre: original,
        decisao_guarda: "seguir"
      });
      expect(JSON.parse(c.ia.corposPorAlvo.guarda[0]!)).toEqual({ texto: original });
      expect(JSON.parse(c.ia.corposPorAlvo.turno[0]!).texto_livre).toBe(original);
    });

    it("mascarar: só o texto mascarado é gravado e enviado à IA; o original fica apenas na Guarda", async () => {
      const { c, sessaoId } = await aberto();
      c.ia.decisaoDaGuarda = "mascarar";
      await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B", textoLivre: original });

      const mascarado = (await turno1(sessaoId)).texto_livre as string;
      expect(mascarado).toMatch(/^\[mascarado\]/);
      expect(await turno1(sessaoId)).toMatchObject({ decisao_guarda: "mascarar" });
      expect(JSON.parse(c.ia.corposPorAlvo.turno[0]!).texto_livre).toBe(mascarado);
      // O original não aparece em nenhuma chamada além da própria Guarda...
      for (const alvo of ["abrir", "turno"] as const) {
        expect(c.ia.corposPorAlvo[alvo].join(" "), alvo).not.toContain("João");
      }
      // ...e não está em lugar nenhum das situações gravadas desta sessão.
      expect(
        await contar(
          `SELECT count(*) AS n FROM leadership_lab.turno t WHERE t.sessao_id = $1 AND to_jsonb(t)::text LIKE '%João%'`,
          [sessaoId]
        )
      ).toBe(0);
    });

    it("bloquear: o texto não é gravado nem enviado, e o teste segue", async () => {
      const { c, sessaoId } = await aberto();
      c.ia.decisaoDaGuarda = "bloquear";
      const r = situacao(
        await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B", textoLivre: original })
      );

      expect(r.situacao.numero).toBe(2);
      expect(await turno1(sessaoId)).toMatchObject({
        texto_livre: null,
        decisao_guarda: "bloquear"
      });
      expect(JSON.parse(c.ia.corposPorAlvo.turno[0]!).texto_livre).toBeNull();
      expect(c.ia.corpos.filter((corpo) => corpo.includes("João"))).toHaveLength(1); // só a Guarda
    });

    it.each([
      ["a Guarda cai", "erro", "TRANSPORTE"],
      ["a Guarda responde fora do contrato", "invalida", "CONTRATO"]
    ] as const)(
      "falha fechada: %s -> o texto é bloqueado, o teste segue e a falha vai para o log",
      async (_n, decisao, codigo) => {
        const { c, sessaoId } = await aberto();
        c.ia.decisaoDaGuarda = decisao;
        const r = situacao(
          await c.motor.responder(c.ator, sessaoId, {
            numero: 1,
            escolha: "B",
            textoLivre: original
          })
        );

        expect(r.situacao.numero).toBe(2);
        expect(await turno1(sessaoId)).toMatchObject({
          texto_livre: null,
          decisao_guarda: "bloquear"
        });
        expect(JSON.parse(c.ia.corposPorAlvo.turno[0]!).texto_livre).toBeNull();
        const logs = await consulta(
          `SELECT sucesso, codigo_erro FROM leadership_lab.log_ia WHERE sessao_id = $1 AND agente = 'guarda'`,
          [sessaoId]
        );
        expect(logs).toEqual([{ sucesso: false, codigo_erro: codigo }]);
      }
    );

    it("a Guarda que demora demais também bloqueia", async () => {
      const { c, sessaoId } = await aberto();
      c.ia.falharNa("guarda", "timeout");
      await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B", textoLivre: original });
      expect(await turno1(sessaoId)).toMatchObject({
        texto_livre: null,
        decisao_guarda: "bloquear"
      });
      const [log] = await consulta(
        `SELECT codigo_erro FROM leadership_lab.log_ia WHERE sessao_id = $1 AND agente = 'guarda'`,
        [sessaoId]
      );
      expect(log.codigo_erro).toBe("TIMEOUT");
    });

    it("sem campo livre a Guarda nem é chamada; com ele, é chamada uma vez e registrada no log", async () => {
      const a = await aberto();
      await a.c.motor.responder(a.c.ator, a.sessaoId, { numero: 1, escolha: "B" });
      expect(a.c.ia.chamadas.guarda).toBe(0);
      expect(await turno1(a.sessaoId)).toMatchObject({ texto_livre: null, decisao_guarda: null });

      const b = await aberto();
      await b.c.motor.responder(b.c.ator, b.sessaoId, {
        numero: 1,
        escolha: "B",
        textoLivre: "Avisaria o gerente."
      });
      expect(b.c.ia.chamadas.guarda).toBe(1);
      const logs = await consulta(
        `SELECT sucesso FROM leadership_lab.log_ia WHERE sessao_id = $1 AND agente = 'guarda'`,
        [b.sessaoId]
      );
      expect(logs).toEqual([{ sucesso: true }]);
    });

    it("repetir a resposta com campo livre não chama a Guarda nem a IA de novo", async () => {
      const { c, sessaoId } = await aberto();
      const entrada = { numero: 1, escolha: "B", textoLivre: "Avisaria o gerente." } as const;
      const primeira = await c.motor.responder(c.ator, sessaoId, entrada);
      expect(await c.motor.responder(c.ator, sessaoId, entrada)).toEqual(primeira);
      expect(c.ia.chamadas).toMatchObject({ guarda: 1, turno: 1 });
    });
  });

  // =========================================================================
  describe("falhas da IA", () => {
    const logsDe = (sessaoId: string | null) =>
      consulta(
        sessaoId === null
          ? `SELECT agente, sucesso, codigo_erro, modelo FROM leadership_lab.log_ia WHERE sessao_id IS NULL AND sucesso = false`
          : `SELECT agente, sucesso, codigo_erro, modelo FROM leadership_lab.log_ia WHERE sessao_id = $1 AND sucesso = false`,
        sessaoId === null ? [] : [sessaoId]
      );

    describe("ao iniciar", () => {
      it.each([
        ["erro de rede", "erro", "LAB_IA_INDISPONIVEL", "TRANSPORTE"],
        ["tempo esgotado", "timeout", "LAB_IA_INDISPONIVEL", "TIMEOUT"],
        ["resposta fora do contrato", "invalida", "LAB_IA_RESPOSTA_INVALIDA", "CONTRATO"]
      ] as const)(
        "%s -> 502, nada fica gravado e dá para tentar de novo",
        async (_n, falha, codigoHttp, codigoLog) => {
          const c = await novoCenario(banco);
          c.ia.falharNa("abrir", falha);

          await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({
            statusCode: 502,
            code: codigoHttp
          });
          expect(
            await contar(
              `SELECT count(*) AS n FROM leadership_lab.sessao WHERE participante_id = $1`,
              [c.ctx.participanteId]
            )
          ).toBe(0);
          const falhas = await consulta(
            `SELECT codigo_erro, sucesso FROM leadership_lab.log_ia WHERE sessao_id IS NULL AND codigo_erro = $1 ORDER BY criado_em DESC LIMIT 1`,
            [codigoLog]
          );
          expect(falhas).toEqual([{ codigo_erro: codigoLog, sucesso: false }]);

          // Tentar de novo funciona.
          expect(situacao(await c.motor.iniciar(c.ator)).situacao.numero).toBe(1);
        }
      );

      it("uma situação que já veio com as opções erradas (duas) não vira teste", async () => {
        const c = await novoCenario(banco);
        c.ia.falharNa("abrir", "invalida");
        await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({
          code: "LAB_IA_RESPOSTA_INVALIDA"
        });
        expect(c.avisos.some((a) => a.mensagem === "chamada à IA falhou")).toBe(true);
      });
    });

    describe("ao responder", () => {
      it("a resposta já dada fica gravada; a reserva é liberada; repetir a mesma resposta conclui", async () => {
        const { c, sessaoId } = await aberto();
        c.ia.falharNa("turno", "erro");

        await expect(
          c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })
        ).rejects.toMatchObject({
          statusCode: 502,
          code: "LAB_IA_INDISPONIVEL"
        });
        expect(await turno1(sessaoId)).toMatchObject({
          escolha: "B",
          tempo_resposta_ms: 7000, // 10 s - 3 s de tolerância
          justificativa: null,
          processando_ate: null
        });
        expect(
          await contar(`SELECT count(*) AS n FROM leadership_lab.turno WHERE sessao_id = $1`, [
            sessaoId
          ])
        ).toBe(1);
        expect(await logsDe(sessaoId)).toEqual([
          {
            agente: "agente_lab",
            sucesso: false,
            codigo_erro: "TRANSPORTE",
            modelo: "desconhecido"
          }
        ]);

        // O participante espera um pouco e repete. O tempo da resposta NÃO muda.
        c.relogio.avancar(40_000);
        const r = situacao(await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" }));
        expect(r.situacao.numero).toBe(2);
        expect(await turno1(sessaoId)).toMatchObject({ tempo_resposta_ms: 7000 });
        expect(c.ia.chamadas.turno).toBe(2);
      });

      it("durante a falha, não dá para trocar a resposta já dada", async () => {
        const { c, sessaoId } = await aberto();
        c.ia.falharNa("turno", "erro");
        await expect(
          c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })
        ).rejects.toMatchObject({ statusCode: 502 });

        await expect(
          c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "A" })
        ).rejects.toMatchObject({
          code: "LAB_RESPOSTA_DIVERGENTE"
        });
        await expect(c.motor.tempoEsgotado(c.ator, sessaoId, { numero: 1 })).rejects.toMatchObject({
          code: "LAB_RESPOSTA_DIVERGENTE"
        });
        expect(c.ia.chamadas.turno).toBe(1);
      });

      it("a falha da IA na omissão também preserva a omissão, e repetir conclui", async () => {
        const { c, sessaoId } = await aberto();
        c.relogio.avancar(60_000);
        c.ia.falharNa("turno", "timeout");
        await expect(c.motor.tempoEsgotado(c.ator, sessaoId, { numero: 1 })).rejects.toMatchObject({
          statusCode: 502
        });
        const r = situacao(await c.motor.tempoEsgotado(c.ator, sessaoId, { numero: 1 }));
        expect(r.tempoEsgotadoNaAnterior).toBe(true);
        expect(r.situacao.numero).toBe(2);
      });

      it("iniciar de novo, depois da falha, refaz a avaliação pendente e devolve a próxima situação", async () => {
        const { c, sessaoId } = await aberto();
        c.ia.falharNa("turno", "erro");
        await expect(
          c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "C" })
        ).rejects.toMatchObject({ statusCode: 502 });

        const retomada = situacao(await c.motor.iniciar(c.ator));
        expect(retomada.sessaoId).toBe(sessaoId);
        expect(retomada.situacao.numero).toBe(2);
        expect(retomada.situacao.consequencia).toContain("[efeito-1]");
        expect((await turno1(sessaoId)).escolha).toBe("C");
      });

      it("falha na última situação não cria resultado; repetir cria um só", async () => {
        const { c, sessaoId } = await aberto();
        let atual = sessaoId;
        for (const n of [1, 2, 3, 4]) {
          await c.motor.responder(c.ator, atual, { numero: n, escolha: "A" });
          c.relogio.avancar(10_000);
        }
        c.ia.falharNa("turno", "erro");
        await expect(
          c.motor.responder(c.ator, atual, { numero: 5, escolha: "A" })
        ).rejects.toMatchObject({ statusCode: 502 });
        expect(
          await contar(`SELECT count(*) AS n FROM leadership_lab.resultado WHERE sessao_id = $1`, [
            atual
          ])
        ).toBe(0);
        expect(
          (await consulta(`SELECT status FROM leadership_lab.sessao WHERE id = $1`, [atual]))[0]
            .status
        ).toBe("em_andamento");

        const final = await c.motor.responder(c.ator, atual, { numero: 5, escolha: "A" });
        expect(final.tipo).toBe("resultado");
        expect(
          await contar(`SELECT count(*) AS n FROM leadership_lab.resultado WHERE sessao_id = $1`, [
            atual
          ])
        ).toBe(1);
        expect(
          await contar(
            `SELECT count(*) AS n FROM leadership_lab.perfil_skill WHERE sessao_id = $1`,
            [atual]
          )
        ).toBe(5);
        atual = "";
      });
    });

    describe("resposta da IA fora do contrato: nada é aplicado", () => {
      type Resp = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const casos: Array<[string, (r: Resp) => Resp]> = [
        [
          "avalia outra letra",
          (r) => ({ ...r, avaliacao_anterior: { ...r.avaliacao_anterior, escolha: "C" } })
        ],
        [
          "trata a resposta como omissão",
          (r) => ({
            ...r,
            avaliacao_anterior: { ...r.avaliacao_anterior, escolha: null, aderencia: 0 }
          })
        ],
        [
          "avalia outra situação",
          (r) => ({ ...r, avaliacao_anterior: { ...r.avaliacao_anterior, numero: 2 } })
        ],
        [
          "aderência fora da escala",
          (r) => ({ ...r, avaliacao_anterior: { ...r.avaliacao_anterior, aderencia: 55 } })
        ],
        [
          "skill inventada",
          (r) => ({ ...r, avaliacao_anterior: { ...r.avaliacao_anterior, skills: ["telepatia"] } })
        ],
        [
          "alerta vermelho sem aderência 10",
          (r) => ({ ...r, avaliacao_anterior: { ...r.avaliacao_anterior, alerta: "vermelho" } })
        ],
        [
          "pula uma situação",
          (r) => ({ ...r, situacao: { ...r.situacao, numero: 3, marco: true } })
        ],
        ["encerra o teste na primeira", () => respostaFinalExemplo() as Resp],
        ["campo a mais (nota)", (r) => ({ ...r, nota: 70 })],
        [
          "só duas opções",
          (r) => ({ ...r, situacao: { ...r.situacao, opcoes: r.situacao.opcoes.slice(0, 2) } })
        ],
        [
          "sem o bloco de uso",
          (r) => Object.fromEntries(Object.entries(r).filter(([chave]) => chave !== "uso"))
        ]
      ];

      it.each(casos)("%s -> 502 e o banco fica como estava", async (_nome, adulterar) => {
        const { c, sessaoId } = await aberto();
        c.ia.adulterarProximoTurno(adulterar);

        await expect(
          c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })
        ).rejects.toMatchObject({
          statusCode: 502,
          code: "LAB_IA_RESPOSTA_INVALIDA"
        });

        // Nada da avaliação foi aplicado.
        expect(await turno1(sessaoId)).toMatchObject({
          escolha: "B",
          justificativa: null,
          processando_ate: null
        });
        for (const tabela of ["turno_skill", "alerta", "contribuicao"]) {
          expect(
            await contar(
              `SELECT count(*) AS n FROM leadership_lab.${tabela} WHERE ${tabela === "turno_skill" ? "turno_id IN (SELECT id FROM leadership_lab.turno WHERE sessao_id = $1)" : "sessao_id = $1"}`,
              [sessaoId]
            ),
            tabela
          ).toBe(0);
        }
        expect(
          await contar(`SELECT count(*) AS n FROM leadership_lab.turno WHERE sessao_id = $1`, [
            sessaoId
          ])
        ).toBe(1);
        expect(await logsDe(sessaoId)).toMatchObject([{ codigo_erro: "CONTRATO" }]);

        // E repetir, agora sem adulteração, funciona.
        expect(
          situacao(await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })).situacao
            .numero
        ).toBe(2);
      });

      it("a IA que quer encerrar o teste antes da hora não cria resultado nem conclui a sessão", async () => {
        const { c, sessaoId } = await aberto();
        c.ia.adulterarProximoTurno(() => respostaFinalExemplo());
        await expect(
          c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })
        ).rejects.toMatchObject({ statusCode: 502 });
        expect(
          await contar(`SELECT count(*) AS n FROM leadership_lab.resultado WHERE sessao_id = $1`, [
            sessaoId
          ])
        ).toBe(0);
        expect(
          (await consulta(`SELECT status FROM leadership_lab.sessao WHERE id = $1`, [sessaoId]))[0]
            .status
        ).toBe("em_andamento");
      });
    });
  });

  // =========================================================================
  describe("requisições simultâneas", () => {
    it("duas respostas iguais ao mesmo tempo: a IA é chamada uma vez e a outra espera", async () => {
      const { c, sessaoId } = await aberto();
      const liberar = c.ia.segurarProximoTurno();
      const marcar = <T>(p: Promise<T>) =>
        p.then(
          (valor) => ({ ok: true as const, valor }),
          (erro: unknown) => ({ ok: false as const, erro })
        );
      const entrada = { numero: 1, escolha: "B" } as const;

      const a = marcar(c.motor.responder(c.ator, sessaoId, entrada));
      const b = marcar(c.motor.responder(c.ator, sessaoId, entrada));
      await esperarAte(() => c.ia.chamadas.turno === 1);

      // A que perdeu a corrida termina primeiro, recusada; a outra segue presa na IA.
      const primeira = await Promise.race([a, b]);
      expect(primeira).toMatchObject({
        ok: false,
        erro: { statusCode: 409, code: "LAB_EM_PROCESSAMENTO" }
      });

      liberar();
      const [ra, rb] = await Promise.all([a, b]);
      const vencedora = [ra, rb].find((r) => r.ok);
      expect(vencedora).toBeDefined();
      expect(c.ia.chamadas.turno).toBe(1);

      // Repetir agora devolve o mesmo resultado da que venceu, sem nova chamada.
      const depois = await c.motor.responder(c.ator, sessaoId, entrada);
      expect(depois).toEqual(vencedora && vencedora.ok ? vencedora.valor : null);
      expect(
        await contar(`SELECT count(*) AS n FROM leadership_lab.turno WHERE sessao_id = $1`, [
          sessaoId
        ])
      ).toBe(2);
      expect(c.ia.chamadas.turno).toBe(1);
    });

    it("a reserva de quem morreu no meio expira e outra requisição assume", async () => {
      const { c, sessaoId } = await aberto();
      c.ia.falharNa("turno", "erro");
      await expect(
        c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })
      ).rejects.toMatchObject({ statusCode: 502 });

      // Simula um processo que reservou o turno e morreu sem liberar.
      const ate = new Date(c.relogio.agora().getTime() + 30_000);
      await consulta(
        `UPDATE leadership_lab.turno SET processando_ate = $1 WHERE sessao_id = $2 AND numero = 1`,
        [ate, sessaoId]
      );

      await expect(
        c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })
      ).rejects.toMatchObject({
        code: "LAB_EM_PROCESSAMENTO"
      });
      c.relogio.avancar(31_000);
      expect(
        situacao(await c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "B" })).situacao
          .numero
      ).toBe(2);
    });

    it("dois 'iniciar' ao mesmo tempo resultam num teste só", async () => {
      const c = await novoCenario(banco);
      const liberar = c.ia.segurarProximaAbertura();
      const a = c.motor.iniciar(c.ator); // fica presa na IA
      await esperarAte(() => c.ia.chamadas.abrir === 1);
      const b = situacao(await c.motor.iniciar(c.ator)); // cria a sessão primeiro
      liberar();
      const ra = situacao(await a); // quando soltar, o índice de uma sessão por participante a impede

      expect(ra.sessaoId).toBe(b.sessaoId);
      expect(
        await contar(`SELECT count(*) AS n FROM leadership_lab.sessao WHERE participante_id = $1`, [
          c.ctx.participanteId
        ])
      ).toBe(1);
      expect(
        await contar(
          `SELECT count(*) AS n FROM leadership_lab.turno t JOIN leadership_lab.sessao s ON s.id = t.sessao_id WHERE s.participante_id = $1`,
          [c.ctx.participanteId]
        )
      ).toBe(1);
      expect(c.ia.chamadas.abrir).toBe(2);
    });
  });

  // =========================================================================
  describe("pré-condições para iniciar", () => {
    it("sem o termo de ciência aceito, não começa; aceitar é idempotente e libera", async () => {
      const c = await novoCenario(banco, { termoAceito: false });
      await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({
        statusCode: 403,
        code: "LAB_TERMO_PENDENTE"
      });
      expect(c.ia.chamadas.abrir).toBe(0);

      const primeiro = await c.motor.aceitarTermo(c.ator);
      const segundo = await c.motor.aceitarTermo(c.ator);
      expect(segundo).toEqual(primeiro);
      expect(
        await contar(
          `SELECT count(*) AS n FROM leadership_lab.termo_aceite WHERE participante_id = $1`,
          [c.ctx.participanteId]
        )
      ).toBe(1);
      expect(situacao(await c.motor.iniciar(c.ator)).situacao.numero).toBe(1);
    });

    it("o aceite de uma versão antiga do termo não vale para a atual", async () => {
      const c = await novoCenario(banco, { termoAceito: false });
      await consulta(
        `INSERT INTO leadership_lab.termo_aceite (participante_id, versao_termo) VALUES ($1, '2025-0')`,
        [c.ctx.participanteId]
      );
      await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({ code: "LAB_TERMO_PENDENTE" });
    });

    it("o molde vem do cargo do cadastro do RH", async () => {
      const semCargo = await novoCenario(banco, { nivel: null });
      await expect(semCargo.motor.iniciar(semCargo.ator)).rejects.toMatchObject({
        statusCode: 409,
        code: "LAB_CARGO_NAO_INFORMADO"
      });

      const funcao = await inserir(banco.db.client, '"JobFunction"', {
        id: crypto.randomUUID(),
        name: "Cargo sem teste",
        updatedAt: new Date().toISOString()
      });
      const semMolde = await novoCenario(banco, {
        nivel: null,
        colaborador: { functionId: funcao }
      });
      await expect(semMolde.motor.iniciar(semMolde.ator)).rejects.toMatchObject({
        statusCode: 409,
        code: "LAB_MOLDE_NAO_MAPEADO"
      });
      expect(semCargo.ia.chamadas.abrir + semMolde.ia.chamadas.abrir).toBe(0);
    });

    it("molde inativo (sem tempo definido) não deixa começar", async () => {
      const c = await novoCenario(banco, { nivel: "coordenador" });
      await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({
        statusCode: 409,
        code: "LAB_MOLDE_INATIVO"
      });
      expect(c.ia.chamadas.abrir).toBe(0);
    });

    it("molde desativado pelo administrador não inicia, mesmo com tempo definido; e sem temas também não", async () => {
      // O banco permite ativo = false com tempo definido (é o que acontece ao desativar um molde).
      await consulta(
        `UPDATE leadership_lab.molde SET ativo = false, tempo_limite_s = 45 WHERE nivel = 'encarregado'`
      );
      const desativado = await novoCenario(banco, { nivel: "encarregado" });
      await expect(desativado.motor.iniciar(desativado.ator)).rejects.toMatchObject({
        code: "LAB_MOLDE_INATIVO"
      });

      await consulta(
        `UPDATE leadership_lab.molde SET ativo = true, temas = '[]'::jsonb WHERE nivel = 'encarregado'`
      );
      const semTemas = await novoCenario(banco, { nivel: "encarregado" });
      await expect(semTemas.motor.iniciar(semTemas.ator)).rejects.toMatchObject({
        code: "LAB_MOLDE_INATIVO"
      });

      await consulta(
        `UPDATE leadership_lab.molde SET temas = '["Execução no turno"]'::jsonb WHERE nivel = 'encarregado'`
      );
      const pronto = await novoCenario(banco, { nivel: "encarregado" });
      expect(situacao(await pronto.motor.iniciar(pronto.ator)).situacao.tempoLimiteS).toBe(45);
      expect(desativado.ia.chamadas.abrir + semTemas.ia.chamadas.abrir).toBe(0);
    });

    it("o participante só confirma o molde do próprio cargo", async () => {
      const c = await novoCenario(banco);
      const [{ id: supervisor }] = await consulta(
        `SELECT id FROM leadership_lab.molde WHERE nivel = 'supervisor'`
      );
      const [{ id: coordenador }] = await consulta(
        `SELECT id FROM leadership_lab.molde WHERE nivel = 'coordenador'`
      );
      await expect(c.motor.iniciar(c.ator, { moldeId: coordenador })).rejects.toMatchObject({
        statusCode: 422,
        code: "LAB_MOLDE_DIVERGENTE"
      });
      expect(situacao(await c.motor.iniciar(c.ator, { moldeId: supervisor })).situacao.numero).toBe(
        1
      );
    });

    it("a IA só recebe o molde, os temas e a quantidade de situações", async () => {
      const c = await novoCenario(banco);
      await c.motor.iniciar(c.ator);
      expect(JSON.parse(c.ia.corposPorAlvo.abrir[0]!)).toEqual({
        molde: "supervisor",
        temas: [
          "Prioridade de OS",
          "Falta de material",
          "Comunicação com o solicitante",
          "Conflito na equipe"
        ],
        numero_situacoes: 5
      });
    });

    describe("limite de testes por dia", () => {
      it("com limite 1: o segundo teste do dia é recusado; no dia seguinte, liberado", async () => {
        const c = await novoCenario(banco, { config: { limiteTestesDia: 1 } });
        await jogar(c, ["A", "A", "A", "A", "A"]);
        await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({
          statusCode: 429,
          code: "LAB_LIMITE_DIARIO",
          details: { limite: 1 }
        });
        expect(c.ia.chamadas.abrir).toBe(1);

        c.relogio.avancar(24 * 3_600_000);
        expect(situacao(await c.motor.iniciar(c.ator)).situacao.numero).toBe(1);
      });

      it("'hoje' é o dia no fuso de São Paulo: a virada é à meia-noite de lá, não de UTC", async () => {
        const c = await novoCenario(banco, { config: { limiteTestesDia: 1 } });
        c.relogio.definir("2026-03-02T01:00:00Z"); // 22h do dia 1º em São Paulo
        await jogar(c, ["A", "A", "A", "A", "A"]);

        c.relogio.definir("2026-03-02T02:59:00Z"); // 23h59 em SP: ainda o mesmo dia
        await expect(c.motor.iniciar(c.ator)).rejects.toMatchObject({ code: "LAB_LIMITE_DIARIO" });
        c.relogio.definir("2026-03-02T03:00:00Z"); // meia-noite em SP
        expect(situacao(await c.motor.iniciar(c.ator)).situacao.numero).toBe(1);
      });

      it("retomar um teste em andamento não conta como outro, nem é barrado pelo limite", async () => {
        const c = await novoCenario(banco, { config: { limiteTestesDia: 1 } });
        const primeira = situacao(await c.motor.iniciar(c.ator));
        expect(situacao(await c.motor.iniciar(c.ator)).sessaoId).toBe(primeira.sessaoId);
      });

      it("teste cancelado não consome o limite", async () => {
        const c = await novoCenario(banco, { config: { limiteTestesDia: 1 } });
        await consulta(
          `INSERT INTO leadership_lab.sessao (participante_id, molde_id, status, iniciada_em)
           VALUES ($1, $2, 'cancelada', $3)`,
          [c.ctx.participanteId, banco.base.moldeId, c.relogio.agora()]
        );
        expect(situacao(await c.motor.iniciar(c.ator)).situacao.numero).toBe(1);
      });

      it("sem limite configurado, não há limite", async () => {
        const c = await novoCenario(banco);
        await jogar(c, ["A", "A", "A", "A", "A"]);
        await jogar(c, ["A", "A", "A", "A", "A"]);
        expect(c.ia.chamadas.abrir).toBe(2);
      });
    });
  });

  // =========================================================================
  describe("permissões", () => {
    it("o participante não mexe no teste de outro: 404 idêntico ao de teste inexistente", async () => {
      const ana = await novoCenario(banco);
      const bia = await novoCenario(banco);
      const { sessaoId } = situacao(await ana.motor.iniciar(ana.ator));
      ana.relogio.avancar(10_000);

      const alheia = await bia.motor
        .responder(bia.ator, sessaoId, { numero: 1, escolha: "A" })
        .catch((e: unknown) => e);
      const inexistente = await bia.motor
        .responder(bia.ator, crypto.randomUUID(), { numero: 1, escolha: "A" })
        .catch((e: unknown) => e);
      const malFormado = await bia.motor
        .responder(bia.ator, "nao-e-um-uuid", { numero: 1, escolha: "A" })
        .catch((e: unknown) => e);

      for (const erro of [alheia, inexistente, malFormado]) {
        expect(erro).toMatchObject({ statusCode: 404, code: "LAB_NOT_FOUND" });
      }
      expect({ ...(alheia as object) }).toEqual({ ...(inexistente as object) });
      expect((alheia as Error).message).toBe((malFormado as Error).message);

      // Nada mudou no teste da Ana, e a IA não foi chamada.
      expect(await turno1(sessaoId)).toMatchObject({ escolha: null, justificativa: null });
      expect(bia.ia.chamadas).toEqual({ abrir: 0, turno: 0, guarda: 0, conversa: 0 });
      await expect(
        bia.motor.tempoEsgotado(bia.ator, sessaoId, { numero: 1 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("quem não é participante é barrado pelo perfil, inclusive DEV e ADMIN; sem vínculo, também", async () => {
      const c = await novoCenario(banco);
      const { sessaoId } = situacao(await c.motor.iniciar(c.ator));
      const ator = (role: LabAtor["role"], participanteId: string | null = null): LabAtor => ({
        userId: crypto.randomUUID(),
        role,
        participanteId,
        permissoes: []
      });

      for (const intruso of [ator("RH"), ator("ADMIN"), ator("RH", c.ctx.participanteId)]) {
        await expect(c.motor.iniciar(intruso), intruso.role).rejects.toMatchObject({
          statusCode: 403,
          code: "LAB_FORBIDDEN"
        });
        await expect(
          c.motor.responder(intruso, sessaoId, { numero: 1, escolha: "A" })
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(c.motor.tempoEsgotado(intruso, sessaoId, { numero: 1 })).rejects.toMatchObject(
          { statusCode: 403 }
        );
        await expect(c.motor.aceitarTermo(intruso)).rejects.toMatchObject({ statusCode: 403 });
      }
      const semVinculo = ator("COMUM", null);
      await expect(c.motor.iniciar(semVinculo)).rejects.toMatchObject({
        statusCode: 403,
        code: "LAB_SEM_VINCULO"
      });
      await expect(
        c.motor.responder(semVinculo, sessaoId, { numero: 1, escolha: "A" })
      ).rejects.toMatchObject({ code: "LAB_SEM_VINCULO" });
      expect(c.ia.chamadas.turno).toBe(0);
    });

    it("entrada com campo estranho, como a aderência, é recusada", async () => {
      const { c, sessaoId } = await aberto();
      await expect(
        c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "A", aderencia: 100 })
      ).rejects.toThrow();
      await expect(
        c.motor.responder(c.ator, sessaoId, { numero: 1, escolha: "Z" })
      ).rejects.toThrow();
      expect(c.ia.chamadas.turno).toBe(0);
    });

    describe("resultado", () => {
      it("o dono lê depois de concluído; antes, não; os outros não leem", async () => {
        const c = await novoCenario(banco);
        const outro = await novoCenario(banco);
        const abertura = situacao(await c.motor.iniciar(c.ator));

        await expect(c.motor.obterResultado(c.ator, abertura.sessaoId)).rejects.toMatchObject({
          statusCode: 409,
          code: "LAB_TESTE_EM_ANDAMENTO"
        });
        let atual: RespostaDoTeste = abertura;
        for (const n of [1, 2, 3, 4, 5]) {
          c.relogio.avancar(10_000);
          atual = await c.motor.responder(c.ator, abertura.sessaoId, { numero: n, escolha: "B" });
        }
        if (atual.tipo !== "resultado") throw new Error("deveria ter terminado");

        expect(await c.motor.obterResultado(c.ator, abertura.sessaoId)).toEqual(atual.resultado);
        await expect(
          outro.motor.obterResultado(outro.ator, abertura.sessaoId)
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(c.motor.obterResultado(c.ator, crypto.randomUUID())).rejects.toMatchObject({
          statusCode: 404
        });
      });

      it("o curador lê só os de quem está nas turmas ativas dele; ADMIN e DEV não leem nenhum", async () => {
        const c = await novoCenario(banco);
        const fora = await novoCenario(banco);
        const respostasDeC = await jogar(c, ["A", "A", "A", "A", "A"]);
        const respostasDeFora = await jogar(fora, ["A", "A", "A", "A", "A"]);
        const idC = situacao(respostasDeC[0]!).sessaoId;
        const idFora = situacao(respostasDeFora[0]!).sessaoId;

        const curadorId = await criarUsuario(banco.db.client, banco.base);
        const curador: LabAtor = {
          userId: curadorId,
          role: "RH",
          participanteId: null,
          permissoes: []
        };
        const turma = await inserir(banco.db.client, "leadership_lab.turma", {
          nome: "T",
          curador_id: curadorId
        });
        await consulta(
          `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
          [turma, c.ctx.participanteId]
        );

        const lido = await c.motor.obterResultado(curador, idC);
        expect(lido.sessaoId).toBe(idC);
        await expect(c.motor.obterResultado(curador, idFora)).rejects.toMatchObject({
          statusCode: 404,
          code: "LAB_NOT_FOUND"
        });

        // Turma encerrada: o curador perde o acesso.
        await consulta(`UPDATE leadership_lab.turma SET ativa = false WHERE id = $1`, [turma]);
        await expect(c.motor.obterResultado(curador, idC)).rejects.toMatchObject({
          statusCode: 404
        });

        for (const role of ["ADMIN"] as const) {
          const admin: LabAtor = { userId: curadorId, role, participanteId: null, permissoes: [] };
          await expect(c.motor.obterResultado(admin, idC)).rejects.toMatchObject({
            statusCode: 403,
            code: "LAB_FORBIDDEN"
          });
        }
      });
    });
  });

  // =========================================================================
  describe("dado pessoal não chega à IA", () => {
    it("numa partida inteira, com campo livre, nada do participante aparece em nenhuma requisição", async () => {
      const c: Cenario = await novoCenario(banco, {
        usuario: { email: "fulana.pereira@empresa.test", name: "Fulana Pereira dos Santos" },
        colaborador: { name: "Fulana Pereira dos Santos", identifier: "MAT-0042" }
      });
      c.ia.decisaoDaGuarda = "mascarar";
      const abertura = situacao(await c.motor.iniciar(c.ator));
      let atual: RespostaDoTeste = abertura;
      for (const n of [1, 2, 3, 4, 5]) {
        c.relogio.avancar(10_000);
        if (atual.tipo !== "situacao") break;
        atual = await c.motor.responder(c.ator, abertura.sessaoId, {
          numero: n,
          escolha: "A",
          textoLivre: n === 2 ? "Chamaria o eletricista para ajudar." : undefined
        });
      }

      const tudo = c.ia.corpos.join("\n");
      for (const pessoal of [
        "Fulana",
        "Pereira",
        "MAT-0042",
        "fulana.pereira",
        "empresa.test",
        c.ctx.userId,
        c.ctx.employeeId,
        c.ctx.participanteId,
        banco.base.operationId,
        abertura.sessaoId, // o id do banco; a IA só conhece o dela
        "Operação",
        "Unidade",
        "Empresa",
        "Cliente"
      ]) {
        expect(tudo, pessoal).not.toContain(pessoal);
      }

      // E cada tipo de chamada só carrega os campos previstos.
      const chaves = (alvo: "abrir" | "turno" | "guarda") =>
        [...new Set(c.ia.corposPorAlvo[alvo].flatMap((b) => Object.keys(JSON.parse(b))))].sort();
      expect(chaves("abrir")).toEqual(["molde", "numero_situacoes", "temas"]);
      expect(chaves("turno")).toEqual([
        "escolha",
        "numero",
        "sessao_id",
        "tempo_esgotado",
        "texto_livre"
      ]);
      expect(chaves("guarda")).toEqual(["texto"]);
    });
  });
});
