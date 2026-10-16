import "server-only";

/**
 * Fixed-window, in-memory rate limiter. Per server instance only, so it is
 * a safety net against runaway loops and accidental cost spikes, not a
 * hard quota (on serverless hosts each instance counts separately).
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; start: number }>();

  return {
    /** Records one hit; returns false when the client is over the limit. */
    take(key: string): boolean {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || now - entry.start >= opts.windowMs) {
        if (hits.size > 1000) hits.clear(); // bound memory
        hits.set(key, { count: 1, start: now });
        return true;
      }
      entry.count++;
      return entry.count <= opts.max;
    },
  };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
