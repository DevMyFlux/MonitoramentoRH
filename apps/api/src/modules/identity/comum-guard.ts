// Trava do perfil COMUM: ele só alcança o que é global (login, sessão, saúde, assistente) e os
// módulos que o registro (packages/shared/src/modules.ts) libera para ele: o Leadership Lab.
// Todo o resto da API responde 403, ANTES de a rota rodar.
//
// Por quê: até aqui só o menu escondia Colaboradores, Escalas e os cadastros do COMUM. As rotas de
// leitura (GET /employees, /employees/export, /operations, /functions, /parameters...) autenticavam,
// mas não conferiam o perfil, e o escopo limitava o ONDE, não o QUEM. Esta regra é de negado-por-
// padrão: rota nova nasce fechada para o COMUM.
//
// Como o perfil é conferido: o token de acesso (15 min) carrega o perfil. Se ele diz COMUM, o banco
// decide (quem foi promovido não fica barrado até o token vencer). Se diz outro perfil, confia no
// token: o pior caso é alguém REBAIXADO a COMUM manter o acesso antigo até 15 min, o mesmo prazo de
// qualquer outra mudança de permissão. Sem token, ou com token inválido, a trava não responde: a
// própria rota devolve 401.
import { moduloDaRotaApi, rotaDaApiPermitidaAoComum } from "@my-flux/shared";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import { verifyAccessToken } from "../auth/token-service.js";
import type { UserRepository } from "../users/user-repository.js";

export function registrarTravaDoComum(
  app: FastifyInstance,
  users: Pick<UserRepository, "findById">,
  apiPrefix: string
): void {
  app.addHook("onRequest", async (request) => {
    const caminho = request.url.split("?")[0] ?? "";
    if (!caminho.startsWith(`${apiPrefix}/`)) return;
    const rota = caminho.slice(apiPrefix.length);
    if (rotaDaApiPermitidaAoComum(rota)) return;
    // Módulo oculto não existe para ninguém: deixa passar para o 404 de rota inexistente (o mesmo que
    // os outros perfis recebem), em vez de um 403 que confirmaria que o módulo existe.
    if (moduloDaRotaApi(rota)?.status === "hidden") return;

    const autorizacao = request.headers.authorization;
    if (!autorizacao?.startsWith("Bearer ")) return;
    const token = verifyAccessToken(autorizacao.slice("Bearer ".length));
    if (!token || token.role !== "COMUM") return;

    // O token diz COMUM: o banco tem a palavra final (promoção recente, conta removida...).
    const usuario = await users.findById(token.sub);
    if (!usuario || usuario.role !== "COMUM") return;

    throw new HttpError(403, "MODULO_FORBIDDEN", "Seu perfil só tem acesso ao Leadership Lab.");
  });
}
