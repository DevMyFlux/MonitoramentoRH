import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser } from "@my-flux/types";

type AccessTokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: AuthenticatedUser["role"];
  exp: number;
};

const DEV_ACCESS_SECRET = "dev-access-secret-change-me";
const DEV_REFRESH_SECRET = "dev-refresh-secret-change-me";
const accessSecret = process.env.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET;

const placeholder = /^(change-?me|dev-.*change-me|example|secret|password)/i;

/**
 * Em produção os segredos de assinatura são OBRIGATÓRIOS. Sem isso o sistema assinaria tokens com um valor público
 * (o que está no repositório) e qualquer pessoa poderia forjar uma sessão. Falha ao subir, com mensagem clara.
 * Segredo curto não derruba o servidor (poderia quebrar um deploy que já funciona): vira aviso.
 */
export function checkAuthConfiguration(env: NodeJS.ProcessEnv = process.env): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (env.NODE_ENV !== "production") return { errors, warnings };
  for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    const value = env[name]?.trim();
    if (!value) errors.push(`${name} não está definido.`);
    else if (placeholder.test(value))
      errors.push(`${name} está com um valor de exemplo; defina um segredo próprio.`);
    else if (value.length < 32)
      warnings.push(`${name} tem menos de 32 caracteres; use um segredo mais longo.`);
  }
  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push("JWT_ACCESS_SECRET e JWT_REFRESH_SECRET precisam ser diferentes.");
  }
  return { errors, warnings };
}

export function assertAuthConfiguration(env: NodeJS.ProcessEnv = process.env): string[] {
  const { errors, warnings } = checkAuthConfiguration(env);
  if (errors.length) {
    throw new Error(
      `Configuração de segurança inválida para produção: ${errors.join(" ")} ` +
        "Sem segredos próprios qualquer pessoa poderia forjar uma sessão."
    );
  }
  return warnings;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createAccessToken(user: AuthenticatedUser): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 15 * 60
    } satisfies AccessTokenPayload)
  );
  const signature = sign(`${header}.${payload}`, accessSecret);

  return `${header}.${payload}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const expectedSignature = sign(`${header}.${payload}`, accessSecret);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  const parsed = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  ) as AccessTokenPayload;

  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsed;
}

export function createOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", process.env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET)
    .update(token)
    .digest("hex");
}
