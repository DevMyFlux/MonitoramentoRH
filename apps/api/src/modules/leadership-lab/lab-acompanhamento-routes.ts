// Leadership Lab — rotas do acompanhamento unificado (RH, ADMIN e DEV). Só leitura.
//   GET /acompanhamento/resumo              visão geral (totais, funil, por turma e por público)
//   GET /acompanhamento/pessoas             as pessoas, com a última sessão
//   GET /acompanhamento/pessoas/:id         uma pessoa: linha do tempo, decisões, comparação
//   GET /acompanhamento/cenarios            por cenário: decisões mais erradas, alternativas mais escolhidas
//   GET /acompanhamento/exportar            CSV (?visao=sessoes|cenarios) com os mesmos filtros
// Todos aceitam ?turmaId&publico&nivel&areaId&de&ate&status.
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { labExportacaoEntradaSchema } from "@my-flux/shared";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { AcompanhamentoDoLab, paraCsv } from "./acompanhamento/acompanhamento.js";
import { idValido } from "./ids.js";
import { carregarAtorLab } from "./lab-actor.js";

/** A querystring vem com "" nos campos em branco do formulário: aqui "em branco" é "sem filtro". */
function semVazios(consulta: unknown): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((consulta ?? {}) as Record<string, unknown>)) {
    if (v !== "" && v !== undefined) saida[k] = v;
  }
  return saida;
}

export async function registrarRotasDoAcompanhamento(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
): Promise<void> {
  const acompanhamento = new AcompanhamentoDoLab(db);
  const contexto = async (request: FastifyRequest) => {
    const user = await authenticateRequest(request, users);
    return { user, ator: await carregarAtorLab(db, user) };
  };

  app.get("/acompanhamento/resumo", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await acompanhamento.resumo(user, ator, semVazios(request.query)) };
  });

  app.get("/acompanhamento/pessoas", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await acompanhamento.pessoas(user, ator, semVazios(request.query)) };
  });

  app.get<{ Params: { id: string } }>("/acompanhamento/pessoas/:id", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await acompanhamento.pessoa(user, ator, idValido(request.params.id)) };
  });

  app.get("/acompanhamento/cenarios", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await acompanhamento.cenarios(user, ator, semVazios(request.query)) };
  });

  app.get("/acompanhamento/exportar", async (request, reply) => {
    const { user, ator } = await contexto(request);
    const { visao, ...filtro } = labExportacaoEntradaSchema.parse(semVazios(request.query));
    const linhas = await acompanhamento.linhasParaExportar(user, ator, filtro, visao);
    const dia = new Date().toISOString().slice(0, 10);
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header(
        "content-disposition",
        `attachment; filename="acompanhamento-lab-${visao}-${dia}.csv"`
      )
      .header("cache-control", "no-store")
      .send(paraCsv(linhas));
  });
}
