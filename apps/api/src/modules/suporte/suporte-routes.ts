// Assistente de suporte do MY FLUX — rota HTTP. Registrada com o prefixo /api/v1/suporte.
//
//   POST /conversa   { mensagem, historico, pagina } -> { data: { desfecho, resposta } }
//
// Qualquer perfil autenticado pode usar: é ajuda de uso do sistema, sem dado de pessoa. A IA é a do
// Leadership Lab (mesmo serviço, mesmo token, mesma Guarda e o mesmo log de consumo). Com o Lab
// desligado (sem LAB_IA_URL e sem modo demonstração) a rota existe e responde 503, para a tela
// poder dizer que o assistente está indisponível em vez de falhar calada.
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../../lib/http-error.js";
import { authenticateRequest } from "../auth/auth-routes.js";
import type { UserRepository } from "../users/user-repository.js";
import { carregarAtorLab } from "../leadership-lab/lab-actor.js";
import type { MotorDoTeste } from "../leadership-lab/motor/motor.js";

const LIMITE_DO_CORPO_BYTES = 32 * 1024;

export async function registrarRotasDoSuporte(
  app: FastifyInstance,
  users: UserRepository,
  { db, motor }: { db: PrismaClient; motor: MotorDoTeste | null }
): Promise<void> {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });

  app.post("/conversa", { bodyLimit: LIMITE_DO_CORPO_BYTES }, async (request) => {
    const user = await authenticateRequest(request, users);
    if (!motor) {
      throw new HttpError(
        503,
        "SUPORTE_INDISPONIVEL",
        "O assistente de suporte não está disponível neste ambiente (serviço de IA desligado)."
      );
    }
    const ator = await carregarAtorLab(db, user);
    // Um teste interno abandonado não deixa o assistente bloqueado para sempre.
    await motor.expirarTesteInterno(ator);
    return { data: await motor.suporte(ator, user, request.body) };
  });

  // O serviço de IA do assistente está de pé e tem o agente de suporte? Só ADMIN e DEV: é diagnóstico
  // de implantação (por exemplo, "desatualizado" = falta reimplantar o serviço lab-ia).
  app.get("/status", async (request) => {
    const user = await authenticateRequest(request, users);
    if (user.role !== "ADMIN" && user.role !== "DEV") {
      throw new HttpError(403, "FORBIDDEN", "Perfil sem permissão para esta ação.");
    }
    if (!motor) {
      return {
        data: { estado: "desligado", versao: null, detalhe: "LAB_IA_URL não está definida." }
      };
    }
    return { data: await motor.estadoDoSuporte() };
  });
}
