/**
 * Optional admin PIN. Edge-runtime safe (Web Crypto only) so it can be used
 * from middleware. The cookie holds a hash of the PIN, never the PIN.
 */

export function getAdminPin(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  return pin ? pin : null;
}

export async function adminToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`price-assistant-admin:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
