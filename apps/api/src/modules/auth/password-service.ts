import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const iterations = 210_000;
const keyLength = 64;
const digest = "sha512";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, iterations, keyLength, digest).toString("hex");

  return `pbkdf2:${iterations}:${digest}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, iterationValue, storedDigest, salt, hash] = storedHash.split(":");

  if (algorithm !== "pbkdf2" || !iterationValue || !storedDigest || !salt || !hash) {
    return false;
  }

  const computed = pbkdf2Sync(
    password,
    salt,
    Number(iterationValue),
    Buffer.from(hash, "hex").length,
    storedDigest
  );

  const stored = Buffer.from(hash, "hex");

  return stored.length === computed.length && timingSafeEqual(stored, computed);
}
