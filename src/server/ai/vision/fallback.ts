import "server-only";
import {
  VisionProviderError,
  type StructuredVisionRequest,
  type StructuredVisionResponse,
  type VisionAttempt,
  type VisionErrorCode,
  type VisionProvider,
  type VisionProviderId,
} from "./types";

/**
 * Tries a chain of providers/models in order, so one overloaded or retired
 * model doesn't stop the shop. It is itself a VisionProvider, so tasks
 * don't know it exists.
 *
 *   overloaded / rate-limited / slow  → retry the same model once, then next
 *   model retired, key bad, no credit → next model straight away
 *   photo refused by a safety filter  → stop (another model will refuse too)
 *
 * The whole chain shares one time budget, because the hosting platform
 * cuts the request off (Vercel: 60 s).
 */

/** Likely to work again in a moment. */
const TRANSIENT = new Set<VisionErrorCode>(["rate_limit", "unavailable", "timeout"]);
/** Will fail the same way on any model. */
const FINAL = new Set<VisionErrorCode>(["refused"]);

export interface FallbackOptions {
  /** Total time for every attempt together. */
  budgetMs?: number;
  /** Cap per attempt, so one hanging model leaves time for the next. */
  attemptTimeoutMs?: number;
  /** Don't start an attempt with less time than this left. */
  minAttemptMs?: number;
  /** Waits before retrying the same model after a transient error. */
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class FallbackVisionProvider implements VisionProvider {
  readonly id: VisionProviderId;
  readonly model: string;
  private readonly opts: Required<FallbackOptions>;

  constructor(
    private readonly chain: VisionProvider[],
    opts: FallbackOptions = {},
  ) {
    if (chain.length === 0) throw new Error("FallbackVisionProvider needs at least one provider");
    this.id = chain[0].id;
    this.model = chain[0].model;
    this.opts = {
      budgetMs: 50_000,
      attemptTimeoutMs: 30_000,
      minAttemptMs: 4_000,
      // With nothing to fall back to, it is worth waiting a little longer.
      retryDelaysMs: chain.length === 1 ? [1_000, 3_000] : [1_000],
      sleep,
      ...opts,
    };
  }

  async generateStructured(req: StructuredVisionRequest): Promise<StructuredVisionResponse> {
    const { budgetMs, attemptTimeoutMs, minAttemptMs, retryDelaysMs } = this.opts;
    const deadline = Date.now() + budgetMs;
    const attempts: VisionAttempt[] = [];
    let lastError: VisionProviderError | null = null;

    chain: for (const provider of this.chain) {
      for (let retry = 0; ; retry++) {
        const left = deadline - Date.now();
        if (attempts.length > 0 && left < minAttemptMs) break chain;

        const started = Date.now();
        try {
          const res = await provider.generateStructured({
            ...req,
            timeoutMs: Math.min(req.timeoutMs ?? attemptTimeoutMs, attemptTimeoutMs, Math.max(left, minAttemptMs)),
          });
          attempts.push({ provider: provider.id, model: res.model, ok: true, ms: Date.now() - started });
          return { ...res, attempts };
        } catch (e) {
          if (!(e instanceof VisionProviderError)) throw e; // e.g. the user cancelled
          attempts.push({ provider: provider.id, model: provider.model, ok: false, code: e.code, ms: Date.now() - started });
          lastError = e;
          if (req.signal?.aborted || FINAL.has(e.code)) break chain;

          const delay = retryDelaysMs[retry];
          if (TRANSIENT.has(e.code) && delay !== undefined && deadline - Date.now() - delay >= minAttemptMs) {
            await this.opts.sleep(delay);
            continue;
          }
          continue chain; // next model
        }
      }
    }

    const error = lastError ?? new VisionProviderError("timeout", "No time left to ask the AI", this.id);
    error.attempts = attempts;
    throw error;
  }
}
