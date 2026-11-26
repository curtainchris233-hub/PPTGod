import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export const LEGACY_PASSWORD_PREFIX = "legacy-scrypt$";

export async function verifyLegacyPassword(password: string, storedHash: string) {
  const [salt, keyHex] = storedHash.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(keyHex ?? "")) return false;
  const key = Buffer.from(keyHex, "hex");
  const derived = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, derived);
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
