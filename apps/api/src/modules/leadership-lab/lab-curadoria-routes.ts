// Leadership Lab — rotas HTTP da curadoria do RH e da contestação do participante.
//
// Registradas no mesmo plugin das demais (lab-routes.ts): mesmo prefixo /api/v1/leadership-lab,
// mesmo "Cache-Control: no-store". Finas de propósito: autenticar, montar o ator, validar a entrada
// (estrita, com os schemas de packages/shared) e entregar ao serviço, que aplica a matriz, a turma e
// as regras. Respostas de sucesso: { data }, como o resto da API.
//
//   Curador (perfil RH), só participantes das turmas ativas dele:
//   GET  /pendencias                      quanto espera uma decisão (os números das abas)
//   GET  /revisao?status=                 a fila de resultados de testes concluídos
//   GET  /revisao/:resultadoId            a ficha de um resultado
//   POST /resultados/:id/validacao        valida, com ajustes de nível opcionais
//   GET  /alertas?status=                 alertas (inclusive de teste em andamento)
//   POST /alertas/:id/tratamento          encerra o alerta, com a nota da conversa
//   GET  /contribuicoes?status=           ideias dos participantes
//   POST /contribuicoes/:id/decisao       aprova ou rejeita
//   GET  /contestacoes?status=            contestações dos participantes
//   POST /contestacoes/:id/decisao        aceita ou rejeita, com a nota
//
//   Participante (perfil COMUM), só o próprio resultado:
//   POST /resultados/:id/contestacoes     contesta um ponto
//   GET  /resultados/:id/contestacoes     as contestações dele, com a decisão
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  labFiltroDaRevisaoSchema,
  labFiltroDeAlertasSchema,
  labFiltroDeContestacoesSchema,
  labFiltroDeContribuicoesSchema
} from "@my-flux/shared";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { AlertasDoLab } from "./curadoria/alertas.js";
import { ContestacoesDoLab } from "./curadoria/contestacoes.js";
import { ContribuicoesDoLab } from "./curadoria/contribuicoes.js";
import { RevisaoDoLab } from "./curadoria/revisao.js";
import { idValido } from "./ids.js";
import { carregarAtorLab } from "./lab-actor.js";

/** Os corpos da curadoria têm só textos curtos (o maior tem teto de 1000 caracteres). */
const LIMITE_DO_CORPO_BYTES = 16 * 1024;

type ComId = { Params: { id: string } };

export async function registrarRotasDaCuradoria(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient,
  opcoes: { exigeBaseValidada?: boolean } = {}
): Promise<void> {
  const revisao = new RevisaoDoLab(db, opcoes);
  const alertas = new AlertasDoLab(db);
  const contribuicoes = new ContribuicoesDoLab(db);
  const contestacoes = new ContestacoesDoLab(db);

  const contexto = async (request: FastifyRequest) => {
    const user = await authenticateRequest(request, users);
    return { user, ator: await carregarAtorLab(db, user) };
  };

  app.get("/pendencias", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await revisao.pendencias(user, ator) };
  });

  app.get("/revisao", async (request) => {
    const { user, ator } = await contexto(request);
    const { status } = labFiltroDaRevisaoSchema.parse(request.query);
    return { data: await revisao.listar(user, ator, status) };
  });

  app.get<{ Params: { resultadoId: string } }>("/revisao/:resultadoId", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await revisao.ficha(user, ator, idValido(request.params.resultadoId)) };
  });

  app.post<ComId>(
    "/resultados/:id/validacao",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => {
      const { user, ator } = await contexto(request);
      return {
        data: await revisao.validar(user, ator, idValido(request.params.id), request.body ?? {})
      };
    }
  );

  app.get("/alertas", async (request) => {
    const { user, ator } = await contexto(request);
    const { status } = labFiltroDeAlertasSchema.parse(request.query);
    return { data: await alertas.listar(user, ator, status) };
  });

  app.post<ComId>(
    "/alertas/:id/tratamento",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => {
      const { user, ator } = await contexto(request);
      return { data: await alertas.tratar(user, ator, idValido(request.params.id), request.body) };
    }
  );

  app.get("/contribuicoes", async (request) => {
    const { user, ator } = await contexto(request);
    const { status } = labFiltroDeContribuicoesSchema.parse(request.query);
    return { data: await contribuicoes.listar(user, ator, status) };
  });

  app.post<ComId>(
    "/contribuicoes/:id/decisao",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => {
      const { user, ator } = await contexto(request);
      return {
        data: await contribuicoes.decidir(user, ator, idValido(request.params.id), request.body)
      };
    }
  );

  app.get("/contestacoes", async (request) => {
    const { user, ator } = await contexto(request);
    const { status } = labFiltroDeContestacoesSchema.parse(request.query);
    return { data: await contestacoes.listar(user, ator, status) };
  });

  app.post<ComId>(
    "/contestacoes/:id/decisao",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => {
      const { user, ator } = await contexto(request);
      return {
        data: await contestacoes.decidir(user, ator, idValido(request.params.id), request.body)
      };
    }
  );

  app.post<ComId>(
    "/resultados/:id/contestacoes",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => {
      const { user, ator } = await contexto(request);
      return {
        data: await contestacoes.criar(user, ator, idValido(request.params.id), request.body)
      };
    }
  );

  app.get<ComId>("/resultados/:id/contestacoes", async (request) => {
    const { ator } = await contexto(request);
    return { data: await contestacoes.listarProprias(ator, idValido(request.params.id)) };
  });
}
