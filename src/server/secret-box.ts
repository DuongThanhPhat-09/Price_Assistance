import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets saved in the database (AI API keys).
 *
 * The key comes from SETTINGS_SECRET. Without it we fall back to a key
 * derived from DATABASE_URL, so a leaked database dump or backup alone
 * still cannot reveal the keys — but set SETTINGS_SECRET in production:
 * changing whichever value is in use makes saved keys unreadable (the
 * admin then simply re-enters them).
 */

const VERSION = "v1";

export function hasSettingsSecret(): boolean {
  return !!process.env.SETTINGS_SECRET?.trim();
}

function encryptionKey(): Buffer {
  const secret = process.env.SETTINGS_SECRET?.trim() || `fallback:${process.env.DATABASE_URL ?? ""}`;
  return createHash("sha256").update(`price-assistant-settings:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Returns null when the value cannot be decrypted (e.g. the secret changed). */
export function decryptSecret(sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "sk-proj-abc…xyz1" → "sk-…xyz1": enough to recognise a key, useless to an attacker. */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return "…" + secret.slice(-2);
  const prefix = /^[a-z]{2,4}-/i.exec(secret)?.[0] ?? secret.slice(0, 3);
  return `${prefix}…${secret.slice(-4)}`;
}
