// Leadership Lab — rotas HTTP do participante.
//
// Finas de propósito: autenticar (o mesmo JWT do restante do sistema), montar o ator com o que
// o banco sabe dele no Lab e entregar ao motor, que aplica a matriz de permissões, as regras e
// a IA. Nenhuma regra de negócio mora aqui. Registradas com o prefixo /api/v1/leadership-lab.
//
//   GET  /painel                        a tela inicial: indicadores, evolução, skills, perfil...
//   GET  /termo                         situação do termo de ciência
//   POST /termo                         aceita a versão atual do termo
//   GET  /moldes                        moldes, com o do cargo do usuário marcado
//   POST /sessoes                       inicia um teste, ou retoma o que está em andamento
//   GET  /sessoes/atual                 lê o teste em andamento (nunca inicia um)
//   POST /sessoes/:id/respostas         envia A, B ou C (e o campo livre)
//   POST /sessoes/:id/tempo-esgotado    avisa que o relógio zerou (o servidor confere)
//   GET  /sessoes/:id/resultado         resultado de um teste concluído
//
// Respostas de sucesso: { data }. Erros: { code, message, details }, pelo tratador global.
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { carregarAtorLab } from "./lab-actor.js";
import type { MotorDoTeste } from "./motor/motor.js";

export type DependenciasDasRotasDoLab = {
  db: PrismaClient;
  motor: MotorDoTeste;
};

/** Nenhum corpo do Lab passa de poucas centenas de bytes (o campo livre tem teto de 1000 caracteres). */
const LIMITE_DO_CORPO_BYTES = 16 * 1024;

type ComId = { Params: { id: string } };

export async function registrarRotasDoLab(
  app: FastifyInstance,
  users: UserRepository,
  { db, motor }: DependenciasDasRotasDoLab
): Promise<void> {
  // Situação do teste, resultado e avaliação são dados pessoais: nada disso fica em cache de
  // navegador, de proxy ou de CDN. Vale também para as respostas de erro.
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });

  const atorDe = async (request: FastifyRequest) =>
    carregarAtorLab(db, await authenticateRequest(request, users));

  app.get("/painel", async (request) => ({
    data: await motor.painel(await atorDe(request))
  }));

  app.get("/termo", async (request) => ({
    data: await motor.situacaoDoTermo(await atorDe(request))
  }));

  app.post("/termo", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => ({
    data: await motor.aceitarTermo(await atorDe(request))
  }));

  app.get("/moldes", async (request) => ({
    data: await motor.listarMoldes(await atorDe(request))
  }));

  app.post("/sessoes", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => ({
    data: await motor.iniciar(await atorDe(request), request.body)
  }));

  app.get("/sessoes/atual", async (request) => ({
    data: await motor.estadoDoTeste(await atorDe(request))
  }));

  app.post<ComId>(
    "/sessoes/:id/respostas",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => ({
      data: await motor.responder(await atorDe(request), request.params.id, request.body)
    })
  );

  app.post<ComId>(
    "/sessoes/:id/tempo-esgotado",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => ({
      data: await motor.tempoEsgotado(await atorDe(request), request.params.id, request.body)
    })
  );

  app.get<ComId>("/sessoes/:id/resultado", async (request) => ({
    data: await motor.obterResultado(await atorDe(request), request.params.id)
  }));
}
