// Treinamentos Interativos — rotas HTTP, prefixo /api/v1/treinamentos. Finas: autenticam, montam
// o ator e delegam ao serviço (treinamentos-servico.ts), onde moram as regras.
//
// Participante (COMUM, DEV vinculado):
//   GET  /minhas                         atribuições abertas e histórico (sem resultado em andamento)
//   GET  /atribuicoes/:id                lê o cenário (sem gabarito) e a tentativa em andamento
//   POST /atribuicoes/:id/tentativas     inicia (o clique) ou retoma a tentativa em andamento
//   POST /tentativas/:id/respostas       { perguntaId, alternativa } -> só a reação dela
//   POST /tentativas/:id/concluir        exige 5 respostas; calcula e grava o desfecho
//   GET  /tentativas/:id/resultado       desfecho, decisões e regras (dono ou curador do escopo)
//   POST /tentativas/:id/simular         "e se?": recalcula sem gravar
// Curadoria (RH das turmas ativas; DEV):
//   GET  /rh/tentativas                  ?situacao=pendentes|validadas|todas&atribuicaoId=
//   POST /rh/tentativas/:id/validar      { nota? }
// Autoria e configuração (ADMIN, DEV):
//   GET  /cenarios                       cenários e versões
//   POST /cenarios                       { conteudo } cria o cenário com a versão 1
//   POST /cenarios/validar               { conteudo } -> { valido, problemas[], resumo }
//   GET  /cenarios/:id/versoes/:versaoId conteúdo completo de uma versão (pré-visualização)
//   POST /cenarios/:id/versoes           { conteudo } nova versão (mesmo slug)
//   POST /cenarios/:id/aprovar           { versaoId } congela a versão
//   GET  /turmas                         turmas ativas do Lab, para atribuir
//   POST /atribuicoes                    { versaoId, turmaId, prazo? }
//
// Gancho futuro (NÃO implementado nesta fase): registrar uma tentativa concluída e validada como
// treinamento/competência do colaborador (aptidão). A ideia é uma rota
// POST /rh/tentativas/:id/registrar-competencia que crie o evento "treinamento" do colaborador
// (participante.employee_id), com auditoria. Nada é gravado em aptidão por enquanto.
//
// Respostas: { data }; erros: { code, message, details } (códigos TREINO_*). Tudo com
// Cache-Control: no-store. Não dependem do Leadership Lab estar ligado nem do modo sem login: as
// rotas exigem o mesmo JWT do resto do sistema.
import {
  treinoAprovarBodySchema,
  treinoAtribuirBodySchema,
  treinoConteudoBodySchema,
  treinoFiltrosDoRhSchema,
  treinoRespostaBodySchema,
  treinoSimularBodySchema,
  treinoValidarTentativaBodySchema
} from "@my-flux/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import type { ServicoDeTreinamentos } from "./treinamentos-servico.js";

const paramsComId = z.object({ id: z.uuid() });
const paramsDaVersao = z.object({ id: z.uuid(), versaoId: z.uuid() });

/** Corpos pequenos, exceto o do conteúdo de cenário (JSON de autoria). */
const LIMITE_DO_CORPO = 16 * 1024;
const LIMITE_DO_CENARIO = 512 * 1024;

export async function registrarRotasDosTreinamentos(
  app: FastifyInstance,
  users: UserRepository,
  servico: ServicoDeTreinamentos
): Promise<void> {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });

  const atorDe = async (request: FastifyRequest) => {
    const user = await authenticateRequest(request, users);
    return servico.carregarAtor({ id: user.id, role: user.role });
  };
  const idDe = (request: FastifyRequest) => paramsComId.parse(request.params).id;
  const pequeno = { bodyLimit: LIMITE_DO_CORPO };
  const grande = { bodyLimit: LIMITE_DO_CENARIO };

  // Participante
  app.get("/minhas", async (request) => ({ data: await servico.minhas(await atorDe(request)) }));

  app.get("/atribuicoes/:id", async (request) => ({
    data: await servico.lerAtribuicao(await atorDe(request), idDe(request))
  }));

  app.post("/atribuicoes/:id/tentativas", pequeno, async (request) => ({
    data: await servico.iniciar(await atorDe(request), idDe(request))
  }));

  app.post("/tentativas/:id/respostas", pequeno, async (request) => {
    const corpo = treinoRespostaBodySchema.parse(request.body);
    return {
      data: await servico.responder(
        await atorDe(request),
        idDe(request),
        corpo.perguntaId,
        corpo.alternativa
      )
    };
  });

  app.post("/tentativas/:id/concluir", pequeno, async (request) => ({
    data: await servico.concluir(await atorDe(request), idDe(request))
  }));

  app.get("/tentativas/:id/resultado", async (request) => ({
    data: await servico.resultado(await atorDe(request), idDe(request))
  }));

  app.post("/tentativas/:id/simular", pequeno, async (request) => {
    const corpo = treinoSimularBodySchema.parse(request.body);
    return { data: await servico.simular(await atorDe(request), idDe(request), corpo.decisoes) };
  });

  // Curadoria
  app.get("/rh/tentativas", async (request) => ({
    data: await servico.listarDoRh(
      await atorDe(request),
      treinoFiltrosDoRhSchema.parse(request.query)
    )
  }));

  app.post("/rh/tentativas/:id/validar", pequeno, async (request) => {
    const corpo = treinoValidarTentativaBodySchema.parse(request.body ?? {});
    return {
      data: await servico.validarTentativa(await atorDe(request), idDe(request), corpo.nota)
    };
  });

  // Autoria e configuração
  app.get("/cenarios", async (request) => ({
    data: await servico.listarCenarios(await atorDe(request))
  }));

  app.post("/cenarios/validar", grande, async (request) => {
    const corpo = treinoConteudoBodySchema.parse(request.body);
    return { data: servico.validar(await atorDe(request), corpo.conteudo) };
  });

  app.post("/cenarios", grande, async (request, reply) => {
    const corpo = treinoConteudoBodySchema.parse(request.body);
    const data = await servico.criarCenario(await atorDe(request), corpo.conteudo);
    return reply.status(201).send({ data });
  });

  app.get("/cenarios/:id/versoes/:versaoId", async (request) => {
    const { id, versaoId } = paramsDaVersao.parse(request.params);
    return { data: await servico.lerVersao(await atorDe(request), id, versaoId) };
  });

  app.post("/cenarios/:id/versoes", grande, async (request, reply) => {
    const corpo = treinoConteudoBodySchema.parse(request.body);
    const data = await servico.novaVersao(await atorDe(request), idDe(request), corpo.conteudo);
    return reply.status(201).send({ data });
  });

  app.post("/cenarios/:id/aprovar", pequeno, async (request) => {
    const corpo = treinoAprovarBodySchema.parse(request.body);
    return {
      data: await servico.aprovarVersao(await atorDe(request), idDe(request), corpo.versaoId)
    };
  });

  app.get("/turmas", async (request) => ({
    data: await servico.listarTurmas(await atorDe(request))
  }));

  app.post("/atribuicoes", pequeno, async (request, reply) => {
    const corpo = treinoAtribuirBodySchema.parse(request.body);
    const data = await servico.atribuir(await atorDe(request), corpo);
    return reply.status(201).send({ data });
  });
}
