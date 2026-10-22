import type { AuthenticatedUser } from "@my-flux/types";
import type { FastifyRequest } from "fastify";
import { HttpError } from "../../lib/http-error.js";
import type { UserRepository } from "../users/user-repository.js";
import { verifyAccessToken } from "./token-service.js";

/**
 * Único ponto que identifica quem está chamando a API. Todas as rotas passam por aqui; qualquer regra nova de
 * sessão (conta bloqueada, desativada...) é feita em `users.findById`, que lê o usuário e as permissões do banco
 * a CADA requisição — por isso uma desativação ou troca de perfil vale imediatamente, sem esperar o token expirar.
 */
export async function authenticateRequest(
  request: FastifyRequest,
  users: UserRepository
): Promise<AuthenticatedUser> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Autenticacao obrigatoria.");
  }

  const payload = verifyAccessToken(authorization.slice("Bearer ".length));

  if (!payload) {
    throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Token invalido.");
  }

  const user = await users.findById(payload.sub);

  if (!user) {
    throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Usuario da sessao nao encontrado.");
  }

  return user;
}
