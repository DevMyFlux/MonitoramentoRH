// Leadership Lab — rotas HTTP dos cadastros do RH e da configuração dos moldes.
//
// Registradas no mesmo plugin das rotas do participante (lab-routes.ts): mesmo prefixo
// /api/v1/leadership-lab, mesmo "Cache-Control: no-store". Finas de propósito: autenticar, montar o
// ator, validar a entrada (estrita, com os schemas de packages/shared) e entregar ao serviço, que
// aplica a matriz, o escopo e as regras. Respostas de sucesso: { data }, como o resto da API.
//
//   Curador (perfil RH), só colaboradores das operações do seu escopo:
//   GET    /participantes                           os participantes, ativos e desativados
//   POST   /participantes                           liga um usuário comum a um colaborador
//   PATCH  /participantes/:id                       desativa ou reativa
//   GET    /colaboradores-elegiveis?busca=          quem ainda pode virar participante
//   GET    /usuarios-elegiveis?busca=               logins comuns ainda sem vínculo
//
//   Curador, só as próprias turmas:
//   GET    /turmas                                  as turmas dele
//   POST   /turmas                                  cria
//   GET    /turmas/:id                              a turma e os participantes
//   PATCH  /turmas/:id                              renomeia, encerra ou reabre
//   POST   /turmas/:id/participantes                inclui um participante
//   DELETE /turmas/:id/participantes/:participanteId  tira um participante
//
//   Administrador (ADMIN e DEV):
//   GET    /config/moldes                           moldes, cargos e testes em andamento
//   PUT    /config/moldes/:nivel                    tempo, liberação e cargos do molde
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  labAtualizarMoldeEntradaSchema,
  labAtualizarParticipanteEntradaSchema,
  labAtualizarTurmaEntradaSchema,
  labBuscaSchema,
  labCadastrarParticipanteEntradaSchema,
  labCriarTurmaEntradaSchema,
  labIncluirNaTurmaEntradaSchema
} from "@my-flux/shared";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { ConfigDosMoldes } from "./cadastro/moldes.js";
import { ParticipantesDoLab } from "./cadastro/participantes.js";
import { TurmasDoLab } from "./cadastro/turmas.js";
import { carregarAtorLab } from "./lab-actor.js";
import { idValido } from "./ids.js";

/** Os corpos do cadastro são pequenos. */
const LIMITE_DO_CORPO_BYTES = 16 * 1024;
/** A lista de cargos de um molde pode chegar a 500 ids. */
const LIMITE_DO_CORPO_DOS_MOLDES_BYTES = 64 * 1024;

type ComId = { Params: { id: string } };

export async function registrarRotasDoCadastro(
  app: FastifyInstance,
  users: UserRepository,
  db: PrismaClient
): Promise<void> {
  const participantes = new ParticipantesDoLab(db);
  const turmas = new TurmasDoLab(db);
  const moldes = new ConfigDosMoldes(db);

  const contexto = async (request: FastifyRequest) => {
    const user = await authenticateRequest(request, users);
    return { user, ator: await carregarAtorLab(db, user) };
  };

  // ---- Participantes ------------------------------------------------------

  app.get("/participantes", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await participantes.listar(user, ator) };
  });

  app.post("/participantes", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => {
    const { user, ator } = await contexto(request);
    const entrada = labCadastrarParticipanteEntradaSchema.parse(request.body);
    return { data: await participantes.cadastrar(user, ator, entrada) };
  });

  app.patch<ComId>("/participantes/:id", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => {
    const { user, ator } = await contexto(request);
    const entrada = labAtualizarParticipanteEntradaSchema.parse(request.body);
    return {
      data: await participantes.atualizar(user, ator, idValido(request.params.id), entrada)
    };
  });

  app.get("/colaboradores-elegiveis", async (request) => {
    const { user, ator } = await contexto(request);
    const { busca } = labBuscaSchema.parse(request.query);
    return { data: await participantes.colaboradoresElegiveis(user, ator, busca) };
  });

  app.get("/usuarios-elegiveis", async (request) => {
    const { ator } = await contexto(request);
    const { busca } = labBuscaSchema.parse(request.query);
    return { data: await participantes.usuariosElegiveis(ator, busca) };
  });

  // ---- Turmas -------------------------------------------------------------

  app.get("/turmas", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await turmas.listar(user, ator) };
  });

  app.post("/turmas", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => {
    const { user, ator } = await contexto(request);
    const entrada = labCriarTurmaEntradaSchema.parse(request.body);
    return { data: await turmas.criar(user, ator, entrada) };
  });

  app.get<ComId>("/turmas/:id", async (request) => {
    const { user, ator } = await contexto(request);
    return { data: await turmas.detalhar(user, ator, idValido(request.params.id)) };
  });

  app.patch<ComId>("/turmas/:id", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => {
    const { user, ator } = await contexto(request);
    const entrada = labAtualizarTurmaEntradaSchema.parse(request.body);
    return { data: await turmas.atualizar(user, ator, idValido(request.params.id), entrada) };
  });

  app.post<ComId>(
    "/turmas/:id/participantes",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => {
      const { user, ator } = await contexto(request);
      const entrada = labIncluirNaTurmaEntradaSchema.parse(request.body);
      return { data: await turmas.incluir(user, ator, idValido(request.params.id), entrada) };
    }
  );

  app.delete<{ Params: { id: string; participanteId: string } }>(
    "/turmas/:id/participantes/:participanteId",
    async (request) => {
      const { user, ator } = await contexto(request);
      return {
        data: await turmas.remover(
          user,
          ator,
          idValido(request.params.id),
          idValido(request.params.participanteId)
        )
      };
    }
  );

  // ---- Configuração dos moldes -------------------------------------------

  app.get("/config/moldes", async (request) => {
    const { ator } = await contexto(request);
    return { data: await moldes.ler(ator) };
  });

  app.put<{ Params: { nivel: string } }>(
    "/config/moldes/:nivel",
    { bodyLimit: LIMITE_DO_CORPO_DOS_MOLDES_BYTES },
    async (request) => {
      const { user, ator } = await contexto(request);
      const entrada = labAtualizarMoldeEntradaSchema.parse(request.body);
      return { data: await moldes.atualizar(user, ator, request.params.nivel, entrada) };
    }
  );
}
