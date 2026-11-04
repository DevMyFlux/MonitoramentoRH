// Leadership Lab — a leitura do painel.
//
// Todas as consultas rodam numa só transação REPEATABLE READ: os blocos do painel vêm do mesmo
// instante. Sem isso, um teste que concluísse no meio da leitura deixaria o cartão dizendo "3
// testes" e o gráfico mostrando 4 pontos.
//
// Só se lê o que já terminou. Todo filtro abaixo exige `sessao.status = 'concluida'`: o que está
// em andamento nunca entra, nem como contagem (veja a regra central em tipos.ts).
import { Prisma, type PrismaClient } from "@prisma/client";
import { podeExibirTendencia } from "@my-flux/shared";
import type { ConfigDoMotor } from "../motor/config.js";
import { avaliarInicio } from "../motor/precondicoes.js";
import {
  type DadosDoPainel,
  type LinhaDeAlerta,
  type LinhaDeEscolha,
  type LinhaDeResultado,
  type LinhaDeSkill,
  type LinhaDoUltimoResultado,
  montarPainel
} from "./montagem.js";
import { LIMITES_DO_PAINEL, type PainelDoParticipante } from "./tipos.js";

type Tx = Prisma.TransactionClient;

type LinhaDaView = {
  testes_feitos: number;
  testes_validados: number;
  aderencia_media: number | null;
  agilidade_media: number | null;
  ultimo_teste_em: Date | null;
};

type LinhaDeSkillBruta = {
  skill_id: string;
  nivel: number;
  n_evidencias: number;
  validado: boolean;
  nivel_validado: number | null;
  sessao_id: string;
  resultado_id: string;
  concluida_em: Date;
};

type LinhaDeAlertaBruta = {
  id: string;
  cor: string;
  criado_em: Date;
  skill_id: string | null;
  skill_nome: string | null;
  situacao: number | null;
  sessao_id: string;
  resultado_id: string | null;
  concluida_em: Date | null;
};

export type ArgumentosDoPainel = {
  participanteId: string;
  config: Pick<ConfigDoMotor, "versaoTermo" | "limiteTestesDia" | "fusoHorario" | "demonstracao">;
  agora: Date;
};

async function lerDadosDoPainel(tx: Tx, args: ArgumentosDoPainel): Promise<DadosDoPainel> {
  const { participanteId, config, agora } = args;
  const doParticipante = { participanteId, status: "concluida" } as const;

  // Termo e ação (o botão). A ação usa as MESMAS regras de POST /sessoes.
  const aceite = await tx.labTermoAceite.findUnique({
    where: { participanteId_versaoTermo: { participanteId, versaoTermo: config.versaoTermo } }
  });
  const estado = await avaliarInicio(tx, { participanteId, config, agora });
  const atual =
    estado.tipo === "continuar"
      ? await tx.labTurno.findFirst({
          where: { sessaoId: estado.sessao.id },
          orderBy: { numero: "desc" },
          select: { numero: true }
        })
      : null;

  // Indicadores: a view que a documentação reserva para o painel.
  const [view] = await tx.$queryRaw<LinhaDaView[]>`
    SELECT testes_feitos, testes_validados, aderencia_media, agilidade_media, ultimo_teste_em
      FROM leadership_lab.vw_painel_participante
     WHERE participante_id = ${participanteId}::uuid`;
  const indicadores = {
    testesFeitos: view?.testes_feitos ?? 0,
    testesValidados: view?.testes_validados ?? 0,
    aderenciaMedia: view?.aderencia_media ?? null,
    agilidadeMedia: view?.agilidade_media ?? null,
    ultimoTesteEm: view?.ultimo_teste_em ?? null
  };

  // Evolução: os testes mais recentes, devolvidos do mais antigo ao mais novo.
  const resultadosBrutos = await tx.labResultado.findMany({
    where: { sessao: doParticipante },
    orderBy: [{ sessao: { concluidaEm: "desc" } }, { id: "desc" }],
    take: LIMITES_DO_PAINEL.pontosDaEvolucao,
    select: {
      id: true,
      sessaoId: true,
      aderenciaGeral: true,
      agilidade: true,
      statusValidacao: true,
      sessao: { select: { concluidaEm: true, _count: { select: { turnos: true } } } }
    }
  });
  const resultados: LinhaDeResultado[] = resultadosBrutos
    .flatMap((r) =>
      r.sessao.concluidaEm === null
        ? [] // teste concluído sempre tem data (restrição do banco); isto só estreita o tipo
        : [
            {
              resultadoId: r.id,
              sessaoId: r.sessaoId,
              concluidaEm: r.sessao.concluidaEm,
              aderenciaGeral: r.aderenciaGeral,
              agilidade: r.agilidade,
              statusValidacao: r.statusValidacao,
              nSituacoes: r.sessao._count.turnos
            }
          ]
    )
    .reverse();

  // Skills: o nível mais recente de cada uma, com o resultado de onde veio.
  const skillsBrutas = await tx.$queryRaw<LinhaDeSkillBruta[]>`
    SELECT DISTINCT ON (ps.skill_id)
           ps.skill_id, ps.nivel, ps.n_evidencias, ps.validado, ps.nivel_validado,
           s.id AS sessao_id, r.id AS resultado_id, s.concluida_em
      FROM leadership_lab.perfil_skill ps
      JOIN leadership_lab.sessao s ON s.id = ps.sessao_id AND s.status = 'concluida'
      JOIN leadership_lab.resultado r ON r.sessao_id = s.id
     WHERE ps.participante_id = ${participanteId}::uuid
     ORDER BY ps.skill_id, s.concluida_em DESC, ps.id DESC`;
  const skills: LinhaDeSkill[] = skillsBrutas.map((l) => ({
    skillId: l.skill_id,
    nivel: l.nivel,
    nEvidencias: l.n_evidencias,
    validado: l.validado,
    nivelValidado: l.nivel_validado,
    sessaoId: l.sessao_id,
    resultadoId: l.resultado_id,
    concluidaEm: l.concluida_em
  }));

  // Tipo de perfil: as escolhas de estilo de todos os testes concluídos. Só se lê quando o perfil
  // pode ser exibido (3 testes): antes disso o dado nem sai do banco.
  const escolhasDeEstilo: LinhaDeEscolha[] = [];
  if (podeExibirTendencia(indicadores.testesFeitos)) {
    const turnos = await tx.labTurno.findMany({
      where: { tempoEsgotado: false, estilo: { not: null }, sessao: doParticipante },
      select: {
        sessaoId: true,
        estilo: true,
        estiloAdequado: true,
        sessao: { select: { resultado: { select: { statusValidacao: true } } } }
      }
    });
    for (const t of turnos) {
      if (t.estilo === null || t.sessao.resultado === null) continue;
      escolhasDeEstilo.push({
        sessaoId: t.sessaoId,
        statusValidacao: t.sessao.resultado.statusValidacao,
        estilo: t.estilo,
        estiloAdequado: t.estiloAdequado
      });
    }
  }

  // Alertas abertos de testes concluídos. Uma consulta só, com junções: pedir ao Prisma três
  // relações irmãs faria ele carregá-las em paralelo, na mesma conexão da transação, o que o
  // driver `pg` avisa que deixará de funcionar.
  const alertasBrutos = await tx.$queryRaw<LinhaDeAlertaBruta[]>`
    SELECT a.id, a.cor, a.criado_em, a.skill_id, k.nome AS skill_nome, t.numero AS situacao,
           s.id AS sessao_id, s.concluida_em, r.id AS resultado_id
      FROM leadership_lab.alerta a
      JOIN leadership_lab.sessao s ON s.id = a.sessao_id
      LEFT JOIN leadership_lab.resultado r ON r.sessao_id = s.id
      LEFT JOIN leadership_lab.skill k ON k.id = a.skill_id
      LEFT JOIN leadership_lab.turno t ON t.id = a.turno_id
     WHERE s.participante_id = ${participanteId}::uuid
       AND s.status = 'concluida'
       AND a.status = 'aberto'`;
  const alertas: LinhaDeAlerta[] = alertasBrutos.map((a) => ({
    id: a.id,
    cor: a.cor,
    criadoEm: a.criado_em,
    skillId: a.skill_id,
    skillNome: a.skill_nome,
    situacao: a.situacao,
    sessaoId: a.sessao_id,
    resultadoId: a.resultado_id,
    concluidaEm: a.concluida_em
  }));

  // Sugestões: as do debriefing do teste mais recente.
  const ultimo = await tx.labResultado.findFirst({
    where: { sessao: doParticipante },
    orderBy: [{ sessao: { concluidaEm: "desc" } }, { id: "desc" }],
    select: {
      id: true,
      sessaoId: true,
      statusValidacao: true,
      sugestoes: true,
      sessao: { select: { concluidaEm: true } }
    }
  });
  const ultimoResultado: LinhaDoUltimoResultado | null =
    ultimo && ultimo.sessao.concluidaEm !== null
      ? {
          resultadoId: ultimo.id,
          sessaoId: ultimo.sessaoId,
          concluidaEm: ultimo.sessao.concluidaEm,
          statusValidacao: ultimo.statusValidacao,
          sugestoes: ultimo.sugestoes
        }
      : null;

  return {
    demonstracao: config.demonstracao === true,
    termo: { versaoAtual: config.versaoTermo, aceitoEm: aceite?.aceitoEm ?? null },
    inicio: { estado, situacaoAtual: atual?.numero ?? null },
    indicadores,
    resultados,
    skills,
    escolhasDeEstilo,
    alertas,
    ultimoResultado
  };
}

/** Lê e monta o painel do participante, num único instante consistente do banco. */
export async function consultarPainel(
  db: PrismaClient,
  args: ArgumentosDoPainel
): Promise<PainelDoParticipante> {
  return db.$transaction(async (tx) => montarPainel(await lerDadosDoPainel(tx, args)), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    timeout: 15_000
  });
}
