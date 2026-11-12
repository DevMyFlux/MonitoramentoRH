// Leadership Lab — ambiente dos testes de integração da curadoria. Só para testes.
//
// Parte do ambiente dos cadastros (aplicativo real, JWT real, PostgreSQL real) e acrescenta
// participantes que JOGAM de verdade, pelo motor e com a IA falsa: assim a curadoria é testada
// sobre resultados, alertas e contribuições gravados pelo mesmo código que os grava em produção.
import type { LabEscolha } from "@my-flux/shared";
import { createAccessToken } from "../../auth/token-service.js";
import { AmbienteDoCadastro, type Pessoa } from "../cadastro/ambiente-do-cadastro.js";
import { type Cenario, jogar, novoCenario } from "../motor/cenario-de-teste.js";
import { IaFalsa, type Roteiro, roteiroPadrao } from "../motor/ia-falsa.js";
import type { RespostaDeResultado } from "../motor/visoes.js";

export type ParticipanteDaCuradoria = {
  cenario: Cenario;
  /** O id em leadership_lab.participante. */
  participanteId: string;
  /** O login (perfil COMUM) dele, para chamar a API como ele. */
  pessoa: Pessoa;
  sessaoId: string | null;
  resultadoId: string | null;
};

export const PREFIXO_DAS_ESCOLHAS: LabEscolha[] = ["A", "B", "C", "B", "A"];

/** Aderência 10 (alerta vermelho) na situação pedida; o resto como o roteiro padrão. */
export function roteiroComAlertaNa(situacao: number, extra: Partial<Roteiro> = {}): Roteiro {
  return {
    ...roteiroPadrao,
    aderencia: (n, escolha) => (n === situacao ? 10 : roteiroPadrao.aderencia(n, escolha)),
    ...extra
  };
}

export class AmbienteDaCuradoria {
  private constructor(readonly cad: AmbienteDoCadastro) {}

  static async subir(
    config: Parameters<typeof AmbienteDoCadastro.subir>[0] = {}
  ): Promise<AmbienteDaCuradoria> {
    return new AmbienteDaCuradoria(await AmbienteDoCadastro.subir(config));
  }

  encerrar(): Promise<void> {
    return this.cad.encerrar();
  }
  http(...args: Parameters<AmbienteDoCadastro["http"]>) {
    return this.cad.http(...args);
  }
  consulta(sql: string, params: unknown[] = []) {
    return this.cad.consulta(sql, params);
  }
  auditoria(entidade: string, entidadeId: string) {
    return this.cad.auditoria(entidade, entidadeId);
  }

  /** Um participante que fez um teste inteiro: o resultado aguarda a validação. */
  async participanteComTeste(
    opcoes: { escolhas?: LabEscolha[]; roteiro?: Roteiro } = {}
  ): Promise<ParticipanteDaCuradoria> {
    const ia = new IaFalsa();
    if (opcoes.roteiro) ia.roteiro = opcoes.roteiro;
    const cenario = await novoCenario(this.cad.banco, { ia });
    const respostas = await jogar(cenario, opcoes.escolhas ?? PREFIXO_DAS_ESCOLHAS);
    const ultima = respostas.at(-1) as RespostaDeResultado;
    return this.montar(cenario, ultima.sessaoId, ultima.resultado.resultadoId);
  }

  /** Um participante com o teste no meio: respondeu `respostas` situações e parou. */
  async participanteEmAndamento(
    opcoes: { respostas?: number; roteiro?: Roteiro } = {}
  ): Promise<ParticipanteDaCuradoria> {
    const ia = new IaFalsa();
    if (opcoes.roteiro) ia.roteiro = opcoes.roteiro;
    const cenario = await novoCenario(this.cad.banco, { ia });
    const feitas = PREFIXO_DAS_ESCOLHAS.slice(0, opcoes.respostas ?? 2);
    const respostas = await jogar(cenario, feitas);
    return this.montar(cenario, respostas[0]!.sessaoId, null);
  }

  private async montar(
    cenario: Cenario,
    sessaoId: string,
    resultadoId: string | null
  ): Promise<ParticipanteDaCuradoria> {
    const { rows } = await this.cad.banco.db.client.query<{ email: string }>(
      `SELECT email FROM "User" WHERE id = $1`,
      [cenario.ctx.userId]
    );
    return {
      cenario,
      participanteId: cenario.ctx.participanteId,
      pessoa: {
        id: cenario.ctx.userId,
        token: createAccessToken({
          id: cenario.ctx.userId,
          email: rows[0]!.email,
          name: "Pessoa",
          role: "COMUM",
          scopes: []
        })
      },
      sessaoId,
      resultadoId
    };
  }

  /** Cria uma turma ativa do curador e põe os participantes nela (direto no banco). */
  async turmaCom(curador: Pessoa, participantes: ParticipanteDaCuradoria[]): Promise<string> {
    const { rows } = await this.cad.banco.db.client.query<{ id: string }>(
      `INSERT INTO leadership_lab.turma (nome, curador_id) VALUES ($1, $2) RETURNING id`,
      [`Turma ${crypto.randomUUID().slice(0, 8)}`, curador.id]
    );
    const turmaId = rows[0]!.id;
    for (const p of participantes) {
      await this.cad.banco.db.client.query(
        `INSERT INTO leadership_lab.turma_participante (turma_id, participante_id) VALUES ($1, $2)`,
        [turmaId, p.participanteId]
      );
    }
    return turmaId;
  }

  /** Um RH comum (escopo global; a curadoria não depende de escopo, e sim de turma). */
  curador(): Promise<Pessoa> {
    return this.cad.rhGlobal();
  }
}
