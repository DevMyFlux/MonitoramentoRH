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
//   POST /sessoes/:id/conversa          conversa com o facilitador sobre o próprio resultado
//   POST /aprendizagem/conversa         dúvidas com o facilitador fora do teste (nunca durante)
//   GET  /simulador/temas               (só no modo demonstração) os temas da simulação local
//   POST /simulador/classificar         (só no modo demonstração) propõe um tema a partir do texto
//
// Os cadastros do RH e a configuração dos moldes ficam em lab-cadastro-routes.ts, e a curadoria e a
// contestação em lab-curadoria-routes.ts (mesmo prefixo).
//
// Respostas de sucesso: { data }. Erros: { code, message, details }, pelo tratador global.
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { type LabCena, labClassificarEntradaSchema } from "@my-flux/shared";
import { assertAcesso } from "./lab-access.js";
import { cenaDaSituacao, simulacaoDaSessao } from "./simulador/cena.js";
import { descreverClassificacao, temasDaBiblioteca } from "./simulador/rotas.js";
import { registrarRotasDoCadastro } from "./lab-cadastro-routes.js";
import { registrarRotasDaCuradoria } from "./lab-curadoria-routes.js";
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

  // Na simulação local, acrescenta à situação quem aparece na cena e ao resultado de que simulação
  // foi. Só apresentação: nada da avaliação. Fora da simulação, não mexe em nada.
  async function comCena<T extends { tipo: string; sessaoId: string }>(resposta: T): Promise<T> {
    if (!motor.temSimulador) return resposta;
    if (resposta.tipo === "situacao") {
      const r = resposta as unknown as { situacao: { numero: number; cena?: LabCena | null } };
      r.situacao.cena = await cenaDaSituacao(db, resposta.sessaoId, r.situacao.numero);
    } else if (resposta.tipo === "resultado") {
      const r = resposta as unknown as { resultado: { simulacao?: unknown } };
      r.resultado.simulacao = await simulacaoDaSessao(db, resposta.sessaoId);
    }
    return resposta;
  }

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
    data: await comCena(await motor.iniciar(await atorDe(request), request.body))
  }));

  app.get("/sessoes/atual", async (request) => ({
    data: await comCena(await motor.estadoDoTeste(await atorDe(request)))
  }));

  app.post<ComId>(
    "/sessoes/:id/respostas",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => ({
      data: await comCena(
        await motor.responder(await atorDe(request), request.params.id, request.body)
      )
    })
  );

  app.post<ComId>(
    "/sessoes/:id/tempo-esgotado",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => ({
      data: await comCena(
        await motor.tempoEsgotado(await atorDe(request), request.params.id, request.body)
      )
    })
  );

  app.get<ComId>("/sessoes/:id/resultado", async (request) => {
    const resultado = await motor.obterResultado(await atorDe(request), request.params.id);
    if (!motor.temSimulador) return { data: resultado };
    const simulacao = await simulacaoDaSessao(db, resultado.sessaoId);
    return { data: { ...resultado, simulacao } };
  });

  app.post<ComId>(
    "/sessoes/:id/conversa",
    { bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request) => ({
      data: await motor.conversar(await atorDe(request), request.params.id, request.body)
    })
  );

  app.post("/aprendizagem/conversa", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => ({
    data: await motor.aprender(await atorDe(request), request.body)
  }));

  if (motor.temSimulador) {
    app.get("/simulador/temas", async (request) => {
      assertAcesso(await atorDe(request), "simulador:ler");
      return { data: temasDaBiblioteca() };
    });

    // O texto digitado só escolhe um tema: não é gravado, não entra em log e não sai do servidor.
    app.post("/simulador/classificar", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => {
      assertAcesso(await atorDe(request), "simulador:ler");
      const { descricao } = labClassificarEntradaSchema.parse(request.body);
      return { data: descreverClassificacao(descricao) };
    });
  }

  await registrarRotasDoCadastro(app, users, db);
  await registrarRotasDaCuradoria(app, users, db, { exigeBaseValidada: motor.exigeBaseValidada });
}
