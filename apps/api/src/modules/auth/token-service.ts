import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser } from "@my-flux/types";

type AccessTokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: AuthenticatedUser["role"];
  exp: number;
};

const accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me";

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
  return createHmac("sha256", process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me")
    .update(token)
    .digest("hex");
}
