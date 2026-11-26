// Leadership Lab — o acompanhamento unificado do teste por cenários (RH, ADMIN e DEV).
//
// Uma só fonte para a visão geral, a lista de pessoas, a pessoa, os cenários e a exportação: todas
// partem de `carregar`, que aplica o MESMO escopo e os MESMOS filtros. Por isso a exportação nunca
// mostra o que a tela não mostraria.
//
// Escopo: DEV e ADMIN leem tudo; o RH, só as pessoas das turmas ATIVAS que acompanha (a matriz
// "turma"); fora dele a resposta é 404, igual a "não existe". Quem faz o teste nunca passa pela
// matriz. Testes de origem "interno" (DEV, ADMIN e RH) ficam fora de médias, funil e comparação.
// Um teste cuja contestação foi DEFERIDA fica anulado: continua visível (marcado), mas não entra nas
// médias.
import {
  type LabAcompanhamentoCenario,
  type LabAcompanhamentoCenarios,
  type LabAcompanhamentoPessoa,
  type LabAcompanhamentoPessoaDetalhe,
  type LabAcompanhamentoPessoas,
  type LabAcompanhamentoResumo,
  type LabAcompanhamentoSessao,
  type LabAtor,
  type LabFiltroDoAcompanhamento,
  type NivelDeGovernanca,
  type TreinoCenario,
  type TreinoDesfecho,
  type TreinoPublico,
  labFiltroDoAcompanhamentoSchema,
  labLimiteDoAcompanhamento,
  treinoCenarioSchema,
  treinoPublicos
} from "@my-flux/shared";
import type { AuthenticatedUser } from "@my-flux/types";
import type { Prisma, PrismaClient } from "@prisma/client";
import { assertAcesso } from "../lab-access.js";
import { carregarParticipantesDasTurmas } from "../lab-actor.js";
import { recursoInexistente } from "../curadoria/acesso.js";

const arredondar = (n: number) => Math.round(n * 10) / 10;
const media = (valores: number[]): number | null =>
  valores.length === 0 ? null : arredondar(valores.reduce((a, b) => a + b, 0) / valores.length);

const cenarioDe = (conteudo: Prisma.JsonValue): TreinoCenario =>
  treinoCenarioSchema.parse(conteudo);
const publicoDe = (valor: string | null): TreinoPublico | null =>
  valor !== null && (treinoPublicos as readonly string[]).includes(valor)
    ? (valor as TreinoPublico)
    : null;

/** O início do dia (UTC) de "AAAA-MM-DD", e o início do dia seguinte (limite exclusivo do fim). */
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const fimDoDia = (dia: string) => new Date(inicioDoDia(dia).getTime() + 24 * 60 * 60 * 1000);

// O que se lê de cada participante: o cadastro, as turmas e as sessões por cenários (com resultado).
const selecaoDaLinha = {
  id: true,
  employee: { select: { name: true, identifier: true, function: { select: { name: true } } } },
  user: {
    select: { cargo: true, nivelGovernanca: true, area: { select: { id: true, nome: true } } }
  },
  turmas: { select: { turma: { select: { id: true, nome: true, ativa: true } } } }
} satisfies Prisma.LabParticipanteSelect;

const selecaoDaSessao = {
  id: true,
  participanteId: true,
  origem: true,
  publico: true,
  status: true,
  iniciadaEm: true,
  concluidaEm: true,
  resultado: {
    select: {
      id: true,
      aderenciaGeral: true,
      agilidade: true,
      experimental: true,
      statusValidacao: true,
      contestacaoDeferidaEm: true
    }
  }
} satisfies Prisma.LabSessaoSelect;

type Linha = Prisma.LabParticipanteGetPayload<{ select: typeof selecaoDaLinha }>;
type SessaoLida = Prisma.LabSessaoGetPayload<{ select: typeof selecaoDaSessao }>;

/** Uma pessoa do escopo, com as sessões (dela, de origem "participante") que passam nos filtros. */
type PessoaCarregada = { linha: Linha; sessoes: SessaoLida[] };

const anulada = (s: SessaoLida) => s.resultado?.contestacaoDeferidaEm != null;
const valida = (s: SessaoLida) => s.status === "concluida" && s.resultado !== null && !anulada(s);

export class AcompanhamentoDoLab {
  constructor(private readonly db: PrismaClient) {}

  // ---- Escopo e filtros -----------------------------------------------------

  /** As turmas que quem pergunta enxerga: as ativas do RH; as ativas de todos, para ADMIN e DEV. */
  private async turmasVisiveis(user: AuthenticatedUser) {
    const todas = user.role === "DEV" || user.role === "ADMIN";
    return this.db.labTurma.findMany({
      where: { ativa: true, ...(todas ? {} : { curadorId: user.id }) },
      select: { id: true, nome: true },
      orderBy: [{ nome: "asc" }, { id: "asc" }]
    });
  }

  private async idsVisiveis(user: AuthenticatedUser): Promise<ReadonlySet<string> | "todos"> {
    if (user.role === "DEV" || user.role === "ADMIN") return "todos";
    return carregarParticipantesDasTurmas(this.db, user.id, user.role);
  }

  private lerFiltro(bruto: unknown): LabFiltroDoAcompanhamento {
    return labFiltroDoAcompanhamentoSchema.parse(bruto ?? {});
  }

  private filtroDeSessao(f: LabFiltroDoAcompanhamento): Prisma.LabSessaoWhereInput {
    return {
      modo: "cenarios",
      ...(f.publico ? { publico: f.publico } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.de || f.ate
        ? {
            iniciadaEm: {
              ...(f.de ? { gte: inicioDoDia(f.de) } : {}),
              ...(f.ate ? { lt: fimDoDia(f.ate) } : {})
            }
          }
        : {})
    };
  }

  /** Há filtro que se aplica à SESSÃO (e que, por isso, esconde quem não tem sessão que passe)? */
  private temFiltroDeSessao(f: LabFiltroDoAcompanhamento) {
    return Boolean(f.publico || f.status || f.de || f.ate);
  }

  /**
   * As pessoas do escopo que passam nos filtros, cada uma com as sessões de origem "participante".
   * Só COMUM é participante de verdade: quem testa por ofício (RH, ADMIN, DEV) aparece à parte.
   */
  private async carregar(
    user: AuthenticatedUser,
    filtro: LabFiltroDoAcompanhamento
  ): Promise<{ pessoas: PessoaCarregada[]; truncado: boolean }> {
    const visiveis = await this.idsVisiveis(user);
    if (visiveis !== "todos" && visiveis.size === 0) return { pessoas: [], truncado: false };
    const filtroDeSessao = this.filtroDeSessao(filtro);
    const comSessao = this.temFiltroDeSessao(filtro);

    const linhas = await this.db.labParticipante.findMany({
      where: {
        ...(visiveis === "todos" ? {} : { id: { in: [...visiveis] } }),
        user: {
          role: { name: "COMUM" },
          ...(filtro.nivel ? { nivelGovernanca: filtro.nivel } : {}),
          ...(filtro.areaId ? { areaId: filtro.areaId } : {})
        },
        ...(filtro.turmaId
          ? { turmas: { some: { turmaId: filtro.turmaId, turma: { ativa: true } } } }
          : {}),
        ...(comSessao ? { sessoes: { some: { ...filtroDeSessao, origem: "participante" } } } : {})
      },
      select: selecaoDaLinha,
      orderBy: [{ employee: { name: "asc" } }, { id: "asc" }],
      take: labLimiteDoAcompanhamento + 1
    });
    const truncado = linhas.length > labLimiteDoAcompanhamento;
    const recorte = linhas.slice(0, labLimiteDoAcompanhamento);

    const sessoes = recorte.length
      ? await this.db.labSessao.findMany({
          where: {
            ...filtroDeSessao,
            origem: "participante",
            participanteId: { in: recorte.map((l) => l.id) }
          },
          select: selecaoDaSessao,
          orderBy: [{ iniciadaEm: "desc" }, { id: "asc" }]
        })
      : [];
    const porPessoa = new Map<string, SessaoLida[]>();
    for (const s of sessoes) {
      const lista = porPessoa.get(s.participanteId) ?? [];
      lista.push(s);
      porPessoa.set(s.participanteId, lista);
    }
    return {
      pessoas: recorte.map((linha) => ({ linha, sessoes: porPessoa.get(linha.id) ?? [] })),
      truncado
    };
  }

  private async contestacoesAbertas(
    participanteIds: string[]
  ): Promise<ReadonlyMap<string, number>> {
    const mapa = new Map<string, number>();
    if (participanteIds.length === 0) return mapa;
    const abertas = await this.db.labContestacao.findMany({
      where: {
        status: { in: ["pendente", "em_analise"] },
        resultado: { sessao: { participanteId: { in: participanteIds } } }
      },
      select: { resultado: { select: { sessao: { select: { participanteId: true } } } } }
    });
    for (const c of abertas) {
      const id = c.resultado.sessao.participanteId;
      mapa.set(id, (mapa.get(id) ?? 0) + 1);
    }
    return mapa;
  }

  // ---- Visão geral ------------------------------------------------------------

  async resumo(
    user: AuthenticatedUser,
    ator: LabAtor,
    filtroBruto: unknown
  ): Promise<LabAcompanhamentoResumo> {
    assertAcesso(ator, "acompanhamento:ler");
    const filtro = this.lerFiltro(filtroBruto);
    const { pessoas } = await this.carregar(user, filtro);
    const abertas = await this.contestacoesAbertas(pessoas.map((p) => p.linha.id));
    const todas = pessoas.flatMap((p) => p.sessoes);
    const validas = todas.filter(valida);

    const porTurma = new Map<string, { nome: string; pessoas: PessoaCarregada[] }>();
    const visiveis = await this.turmasVisiveis(user);
    for (const t of visiveis) {
      if (filtro.turmaId && t.id !== filtro.turmaId) continue;
      porTurma.set(t.id, { nome: t.nome, pessoas: [] });
    }
    for (const p of pessoas)
      for (const t of p.linha.turmas) porTurma.get(t.turma.id)?.pessoas.push(p);

    const areas = await this.db.area.findMany({
      where: { ativa: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" }
    });

    return {
      totais: {
        participantes: pessoas.length,
        iniciaram: pessoas.filter((p) => p.sessoes.length > 0).length,
        emAndamento: todas.filter((s) => s.status === "em_andamento").length,
        concluidas: validas.length,
        aderenciaMedia: media(validas.map((s) => s.resultado!.aderenciaGeral)),
        agilidadeMedia: media(validas.map((s) => s.resultado!.agilidade)),
        contestacoesAbertas: [...abertas.values()].reduce((a, b) => a + b, 0)
      },
      funil: {
        cadastrados: pessoas.length,
        iniciaram: pessoas.filter((p) => p.sessoes.length > 0).length,
        concluiram: pessoas.filter((p) => p.sessoes.some(valida)).length
      },
      porTurma: [...porTurma.entries()].map(([turmaId, t]) => ({
        turmaId,
        nome: t.nome,
        participantes: t.pessoas.length,
        iniciaram: t.pessoas.filter((p) => p.sessoes.length > 0).length,
        concluiram: t.pessoas.filter((p) => p.sessoes.some(valida)).length,
        aderenciaMedia: media(
          t.pessoas.flatMap((p) => p.sessoes.filter(valida).map((s) => s.resultado!.aderenciaGeral))
        )
      })),
      porPublico: treinoPublicos
        .map((publico) => {
          const deste = todas.filter((s) => s.publico === publico);
          const v = deste.filter(valida);
          return {
            publico,
            sessoes: deste.length,
            concluidas: v.length,
            aderenciaMedia: media(v.map((s) => s.resultado!.aderenciaGeral))
          };
        })
        .filter((l) => l.sessoes > 0),
      internos: await this.internos(user, filtro),
      opcoes: { turmas: visiveis, areas }
    };
  }

  /** Os testes de origem "interno" no período e público pedidos (fora de qualquer média). */
  private async internos(user: AuthenticatedUser, filtro: LabFiltroDoAcompanhamento) {
    const visiveis = await this.idsVisiveis(user);
    const where: Prisma.LabSessaoWhereInput = {
      ...this.filtroDeSessao(filtro),
      origem: "interno",
      ...(visiveis === "todos" ? {} : { participanteId: { in: [...visiveis] } })
    };
    const [sessoes, concluidas] = await Promise.all([
      this.db.labSessao.count({ where }),
      this.db.labSessao.count({ where: { ...where, status: "concluida" } })
    ]);
    return { sessoes, concluidas };
  }

  // ---- Pessoas -----------------------------------------------------------------

  private async visaoDaPessoa(
    p: PessoaCarregada,
    abertas: ReadonlyMap<string, number>
  ): Promise<LabAcompanhamentoPessoa> {
    const ultima = p.sessoes[0] ?? null;
    return {
      participanteId: p.linha.id,
      nome: p.linha.employee.name,
      identificador: p.linha.employee.identifier,
      cargo: p.linha.user.cargo ?? p.linha.employee.function?.name ?? null,
      nivel: (p.linha.user.nivelGovernanca as NivelDeGovernanca | null) ?? null,
      area: p.linha.user.area?.nome ?? null,
      turmas: p.linha.turmas.filter((t) => t.turma.ativa).map((t) => t.turma.nome),
      sessoes: p.sessoes.length,
      concluidas: p.sessoes.filter(valida).length,
      contestacoesAbertas: abertas.get(p.linha.id) ?? 0,
      ultima: ultima
        ? {
            sessaoId: ultima.id,
            status: ultima.status === "concluida" ? "concluida" : "em_andamento",
            publico: publicoDe(ultima.publico),
            iniciadaEm: ultima.iniciadaEm.toISOString(),
            concluidaEm: ultima.concluidaEm?.toISOString() ?? null,
            aderenciaGeral: ultima.resultado?.aderenciaGeral ?? null,
            agilidade: ultima.resultado?.agilidade ?? null,
            experimental: ultima.resultado?.experimental ?? false,
            contestadoDeferido: anulada(ultima)
          }
        : null
    };
  }

  async pessoas(
    user: AuthenticatedUser,
    ator: LabAtor,
    filtroBruto: unknown
  ): Promise<LabAcompanhamentoPessoas> {
    assertAcesso(ator, "acompanhamento:ler");
    const { pessoas, truncado } = await this.carregar(user, this.lerFiltro(filtroBruto));
    const abertas = await this.contestacoesAbertas(pessoas.map((p) => p.linha.id));
    return {
      pessoas: await Promise.all(pessoas.map((p) => this.visaoDaPessoa(p, abertas))),
      truncado
    };
  }

  // ---- Uma pessoa --------------------------------------------------------------

  async pessoa(
    user: AuthenticatedUser,
    ator: LabAtor,
    participanteId: string
  ): Promise<LabAcompanhamentoPessoaDetalhe> {
    assertAcesso(ator, "acompanhamento:ler");
    const linha = await this.db.labParticipante.findUnique({
      where: { id: participanteId },
      select: selecaoDaLinha
    });
    if (!linha) recursoInexistente(ator, "acompanhamento:ler");
    const visiveis = await this.idsVisiveis(user);
    assertAcesso(ator, "acompanhamento:ler", {
      participanteId,
      participantesDasTurmas: visiveis === "todos" ? new Set([participanteId]) : visiveis
    });

    const sessoes = await this.db.labSessao.findMany({
      where: { participanteId, modo: "cenarios" },
      select: {
        ...selecaoDaSessao,
        cenarios: {
          orderBy: { ordem: "asc" },
          select: {
            ordem: true,
            status: true,
            iniciadaEm: true,
            concluidaEm: true,
            decisoes: true,
            desfecho: true,
            cenarioVersao: { select: { numero: true, conteudo: true } },
            respostas: { orderBy: { respondidaEm: "asc" } }
          }
        }
      },
      orderBy: [{ iniciadaEm: "desc" }, { id: "asc" }]
    });
    const resultadoIds = sessoes.flatMap((s) => (s.resultado ? [s.resultado.id] : []));
    const contestacoes = resultadoIds.length
      ? await this.db.labContestacao.findMany({
          where: { resultadoId: { in: resultadoIds } },
          orderBy: [{ criadoEm: "desc" }, { id: "asc" }]
        })
      : [];

    const abertas = await this.contestacoesAbertas([participanteId]);
    const sessoesDaPessoa = sessoes.filter((s) => s.origem === "participante");
    const pessoa = await this.visaoDaPessoa({ linha, sessoes: sessoesDaPessoa }, abertas);

    const visao: LabAcompanhamentoSessao[] = sessoes.map((s) => ({
      sessaoId: s.id,
      origem: s.origem === "interno" ? "interno" : "participante",
      publico: publicoDe(s.publico),
      status: s.status === "concluida" ? "concluida" : "em_andamento",
      iniciadaEm: s.iniciadaEm.toISOString(),
      concluidaEm: s.concluidaEm?.toISOString() ?? null,
      resultadoId: s.resultado?.id ?? null,
      aderenciaGeral: s.resultado?.aderenciaGeral ?? null,
      agilidade: s.resultado?.agilidade ?? null,
      experimental: s.resultado?.experimental ?? false,
      statusValidacao: s.resultado
        ? (s.resultado.statusValidacao as LabAcompanhamentoSessao["statusValidacao"])
        : null,
      contestadoDeferido: anulada(s),
      cenarios: s.cenarios.map((c) => {
        const cenario = cenarioDe(c.cenarioVersao.conteudo);
        const decisoes = (c.decisoes ?? {}) as Record<string, boolean>;
        const concluido = c.status === "concluida";
        const tempos = c.respostas.flatMap((r) => (r.tempoMs === null ? [] : [r.tempoMs]));
        return {
          ordem: c.ordem,
          titulo: cenario.title,
          area: cenario.area,
          versao: c.cenarioVersao.numero,
          exemplo: cenario.exemplo,
          status: c.status as "pendente" | "em_andamento" | "concluida",
          iniciadoEm: c.iniciadaEm?.toISOString() ?? null,
          concluidoEm: c.concluidaEm?.toISOString() ?? null,
          tempoTotalMs: tempos.length ? tempos.reduce((a, b) => a + b, 0) : null,
          decisoes: concluido
            ? cenario.decisions.map((d) => ({
                id: d.id,
                label: d.label,
                cumpriu: decisoes[d.id] === true
              }))
            : [],
          respostas: c.respostas.map((r) => {
            const pergunta = cenario.questions.find((q) => q.id === r.perguntaId);
            return {
              perguntaId: r.perguntaId,
              prompt: pergunta?.prompt ?? "",
              alternativa: r.alternativa,
              texto: pergunta?.alternatives[r.alternativa]?.text ?? "",
              tempoMs: r.tempoMs
            };
          }),
          desfechos: concluido
            ? (c.desfecho as unknown as TreinoDesfecho).outcomes.map((o) => ({
                nivel: o.nivel,
                texto: o.texto
              }))
            : []
        };
      })
    }));

    return {
      pessoa,
      sessoes: visao,
      contestacoes: contestacoes.map((c) => ({
        id: c.id,
        resultadoId: c.resultadoId,
        ponto: c.ponto,
        motivo: c.motivo,
        status: c.status as "pendente" | "em_analise" | "aceita" | "rejeitada",
        criadoEm: c.criadoEm.toISOString(),
        decididoEm: c.decididoEm?.toISOString() ?? null,
        nota: c.notaDecisao
      })),
      comparacao: await this.comparar(user, participanteId, sessoesDaPessoa)
    };
  }

  /**
   * A pessoa contra o grupo: os OUTROS participantes (origem "participante") do mesmo público que
   * quem pergunta enxerga, só com testes que valem. Sem teste válido ou sem ninguém mais, não há
   * comparação (nulo).
   */
  private async comparar(
    user: AuthenticatedUser,
    participanteId: string,
    dela: SessaoLida[]
  ): Promise<LabAcompanhamentoPessoaDetalhe["comparacao"]> {
    const validas = dela.filter(valida);
    const publico = publicoDe(validas[0]?.publico ?? null);
    if (!validas.length || !publico) return null;
    const visiveis = await this.idsVisiveis(user);
    const doGrupo = await this.db.labSessao.findMany({
      where: {
        modo: "cenarios",
        origem: "participante",
        publico,
        status: "concluida",
        participanteId: {
          not: participanteId,
          ...(visiveis === "todos" ? {} : { in: [...visiveis] })
        },
        resultado: { is: { contestacaoDeferidaEm: null } },
        participante: { user: { role: { name: "COMUM" } } }
      },
      select: {
        participanteId: true,
        resultado: { select: { aderenciaGeral: true, agilidade: true } }
      }
    });
    const outros = new Set(doGrupo.map((s) => s.participanteId));
    if (outros.size === 0) return null;
    return {
      publico,
      pessoas: outros.size + 1,
      aderenciaDaPessoa: media(validas.map((s) => s.resultado!.aderenciaGeral))!,
      aderenciaDoGrupo: media(doGrupo.map((s) => s.resultado!.aderenciaGeral))!,
      agilidadeDaPessoa: media(validas.map((s) => s.resultado!.agilidade))!,
      agilidadeDoGrupo: media(doGrupo.map((s) => s.resultado!.agilidade))!
    };
  }

  // ---- Cenários ------------------------------------------------------------------

  async cenarios(
    user: AuthenticatedUser,
    ator: LabAtor,
    filtroBruto: unknown
  ): Promise<LabAcompanhamentoCenarios> {
    assertAcesso(ator, "acompanhamento:ler");
    const { pessoas } = await this.carregar(user, this.lerFiltro(filtroBruto));
    const sessaoIds = pessoas.flatMap((p) => p.sessoes.filter((s) => !anulada(s)).map((s) => s.id));
    if (sessaoIds.length === 0) return { cenarios: [] };

    const tentativas = await this.db.labTentativaCenario.findMany({
      where: { status: "concluida", sessaoId: { in: sessaoIds } },
      select: {
        decisoes: true,
        sessao: { select: { participanteId: true } },
        cenarioVersao: {
          select: {
            id: true,
            numero: true,
            conteudo: true,
            cenarioId: true,
            cenario: { select: { slug: true } }
          }
        },
        respostas: { select: { perguntaId: true, alternativa: true } }
      }
    });

    type Grupo = {
      versao: { numero: number; cenarioId: string; slug: string; cenario: TreinoCenario };
      pessoas: Set<string>;
      vezes: number;
      cumpridas: number;
      totais: number;
      decisoes: Map<string, { label: string; vezes: number; descumpridas: number }>;
      perguntas: Map<string, Map<number, number>>;
    };
    const grupos = new Map<string, Grupo>();
    for (const t of tentativas) {
      const cenario = cenarioDe(t.cenarioVersao.conteudo);
      let g = grupos.get(t.cenarioVersao.id);
      if (!g) {
        g = {
          versao: {
            numero: t.cenarioVersao.numero,
            cenarioId: t.cenarioVersao.cenarioId,
            slug: t.cenarioVersao.cenario.slug,
            cenario
          },
          pessoas: new Set(),
          vezes: 0,
          cumpridas: 0,
          totais: 0,
          decisoes: new Map(),
          perguntas: new Map()
        };
        grupos.set(t.cenarioVersao.id, g);
      }
      g.vezes++;
      g.pessoas.add(t.sessao.participanteId);
      const decisoes = (t.decisoes ?? {}) as Record<string, boolean>;
      for (const d of cenario.decisions) {
        const linha = g.decisoes.get(d.id) ?? { label: d.label, vezes: 0, descumpridas: 0 };
        linha.vezes++;
        g.totais++;
        if (decisoes[d.id] === true) g.cumpridas++;
        else linha.descumpridas++;
        g.decisoes.set(d.id, linha);
      }
      for (const r of t.respostas) {
        const contagem = g.perguntas.get(r.perguntaId) ?? new Map<number, number>();
        contagem.set(r.alternativa, (contagem.get(r.alternativa) ?? 0) + 1);
        g.perguntas.set(r.perguntaId, contagem);
      }
    }

    const cenarios: LabAcompanhamentoCenario[] = [...grupos.values()].map((g) => ({
      cenarioId: g.versao.cenarioId,
      versao: g.versao.numero,
      slug: g.versao.slug,
      titulo: g.versao.cenario.title,
      area: g.versao.cenario.area,
      publico: publicoDe(g.versao.cenario.publico ?? null),
      vezes: g.vezes,
      pessoas: g.pessoas.size,
      aderenciaMedia: g.totais ? arredondar((g.cumpridas / g.totais) * 100) : null,
      decisoes: [...g.decisoes.entries()]
        .map(([id, d]) => ({
          id,
          label: d.label,
          vezes: d.vezes,
          descumpridas: d.descumpridas,
          taxaDeDescumprimento: d.vezes ? arredondar((d.descumpridas / d.vezes) * 100) : 0
        }))
        .sort(
          (a, b) => b.taxaDeDescumprimento - a.taxaDeDescumprimento || a.id.localeCompare(b.id)
        ),
      perguntas: g.versao.cenario.questions.map((q) => {
        const contagem = g.perguntas.get(q.id) ?? new Map<number, number>();
        const total = [...contagem.values()].reduce((a, b) => a + b, 0);
        return {
          id: q.id,
          prompt: q.prompt,
          alternativas: q.alternatives
            .map((a, indice) => {
              const escolhas = contagem.get(indice) ?? 0;
              return {
                indice,
                texto: a.text,
                escolhas,
                pct: total ? arredondar((escolhas / total) * 100) : 0
              };
            })
            .sort((a, b) => b.escolhas - a.escolhas || a.indice - b.indice)
        };
      })
    }));
    // Os cenários mais difíceis primeiro (menor aderência), depois pelo título.
    cenarios.sort(
      (a, b) =>
        (a.aderenciaMedia ?? 101) - (b.aderenciaMedia ?? 101) ||
        a.titulo.localeCompare(b.titulo) ||
        a.versao - b.versao
    );
    return { cenarios };
  }

  // ---- Exportação ------------------------------------------------------------------

  /** As linhas da exportação, com os MESMOS filtros e a MESMA visibilidade das telas. */
  async linhasParaExportar(
    user: AuthenticatedUser,
    ator: LabAtor,
    filtroBruto: unknown,
    visao: "sessoes" | "cenarios"
  ): Promise<string[][]> {
    assertAcesso(ator, "acompanhamento:exportar");
    const filtro = this.lerFiltro(filtroBruto);
    if (visao === "cenarios") {
      const { cenarios } = await this.cenarios(user, ator, filtro);
      return [
        [
          "Cenário",
          "Versão",
          "Área",
          "Público",
          "Vezes feito",
          "Pessoas",
          "Aderência média (%)",
          "Decisão",
          "Vezes",
          "Descumpridas",
          "Descumprimento (%)"
        ],
        ...cenarios.flatMap((c) =>
          c.decisoes.map((d) => [
            c.titulo,
            String(c.versao),
            c.area,
            c.publico ?? "",
            String(c.vezes),
            String(c.pessoas),
            c.aderenciaMedia === null ? "" : String(c.aderenciaMedia),
            d.label,
            String(d.vezes),
            String(d.descumpridas),
            String(d.taxaDeDescumprimento)
          ])
        )
      ];
    }
    const { pessoas } = await this.carregar(user, filtro);
    return [
      [
        "Nome",
        "Identificador",
        "Cargo",
        "Nível",
        "Área",
        "Turmas",
        "Público",
        "Início",
        "Conclusão",
        "Situação",
        "Aderência (%)",
        "Agilidade (%)",
        "Resultado experimental",
        "Validação",
        "Teste anulado (contestação deferida)"
      ],
      ...pessoas.flatMap((p) =>
        p.sessoes.map((s) => [
          p.linha.employee.name,
          p.linha.employee.identifier,
          p.linha.user.cargo ?? p.linha.employee.function?.name ?? "",
          p.linha.user.nivelGovernanca ?? "",
          p.linha.user.area?.nome ?? "",
          p.linha.turmas
            .filter((t) => t.turma.ativa)
            .map((t) => t.turma.nome)
            .join(" | "),
          s.publico ?? "",
          s.iniciadaEm.toISOString(),
          s.concluidaEm?.toISOString() ?? "",
          s.status === "concluida" ? "Concluída" : "Em andamento",
          s.resultado ? String(s.resultado.aderenciaGeral) : "",
          s.resultado ? String(s.resultado.agilidade) : "",
          s.resultado ? (s.resultado.experimental ? "sim" : "não") : "",
          s.resultado?.statusValidacao ?? "",
          anulada(s) ? "sim" : "não"
        ])
      )
    ];
  }
}

/**
 * Uma célula de CSV. Aspas dobradas, campo entre aspas quando há `;`, aspas ou quebra de linha, e
 * um apóstrofo na frente de texto que a planilha leria como fórmula (= + - @, tabulação).
 */
export function celulaDeCsv(valor: string): string {
  const seguro =
    /^[=+\-@\t\r]/.test(valor) && !/^-?\d+([.,]\d+)?$/.test(valor) ? `'${valor}` : valor;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

/** O CSV como o Excel em português lê: `;` entre colunas, vírgula decimal e BOM no começo. */
export function paraCsv(linhas: string[][]): string {
  const corpo = linhas
    .map((l) =>
      l.map((c) => celulaDeCsv(/^-?\d+\.\d+$/.test(c) ? c.replace(".", ",") : c)).join(";")
    )
    .join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}
