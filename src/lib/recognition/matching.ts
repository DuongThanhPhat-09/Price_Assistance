import { tokenMatch } from "../search/fuzzy";
import { normalizeText, tokenize } from "../text";
import type { LookupOutcome, MatchReason } from "../types";

/**
 * Decides whether a recognised photo is a product the shop already has,
 * so the owner can pick it instead of creating a duplicate.
 *
 * Pure (no I/O): the server fetches candidates with the normal fuzzy search
 * and then scores each one here on an absolute 0..1 scale, which the UI
 * shows as "95% match".
 */

/** Below this a recognition is "not fully confident": warn, never save unchecked. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
/** Weaker candidates are not worth showing as "possible match". */
export const MIN_MATCH_SCORE = 0.6;
export const MAX_MATCHES = 3;

export interface MatchQuery {
  name: string;
  brand?: string | null;
  model?: string | null;
  barcode?: string | null;
}

export interface MatchCandidate {
  name: string;
  brand?: string | null;
  model?: string | null;
  barcode?: string | null;
  description?: string | null;
}

/** "WEG-6801 W" → "weg6801w": model numbers are compared without spacing. */
export function compactCode(input: string | null | undefined): string {
  return normalizeText(input ?? "").replace(/[^a-z0-9]/g, "");
}

/** Average best fuzzy match of each token in `a` against the tokens of `b` (0..1). */
function coverage(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let sum = 0;
  for (const q of a) {
    let best = 0;
    for (const t of b) best = Math.max(best, tokenMatch(q, t));
    sum += best;
  }
  return sum / a.length;
}

/** Symmetric token similarity: both names must cover each other. */
export function nameSimilarity(a: string, b: string): number {
  const ta = [...new Set(tokenize(a))];
  const tb = [...new Set(tokenize(b))];
  const ab = coverage(ta, tb);
  const ba = coverage(tb, ta);
  return ab + ba === 0 ? 0 : (2 * ab * ba) / (ab + ba); // harmonic mean
}

export function scoreProductMatch(
  query: MatchQuery,
  candidate: MatchCandidate,
): { score: number; reasons: MatchReason[] } {
  if (query.barcode && candidate.barcode && query.barcode === candidate.barcode) {
    return { score: 1, reasons: ["barcode"] };
  }

  const reasons: MatchReason[] = [];
  const brand = normalizeText(query.brand ?? "");
  const candidateText = [candidate.brand, candidate.model, candidate.name, candidate.description]
    .filter(Boolean)
    .join(" ");
  const brandMatches = brand.length > 0 && ` ${normalizeText(candidateText)} `.includes(` ${brand} `);

  // Compare "brand + name" on both sides so a product saved without the
  // brand in its name still lines up.
  const left = [query.brand && !normalizeText(query.name).includes(brand) ? query.brand : "", query.name].join(" ");
  const right = [candidate.brand ?? "", candidate.name].join(" ");
  let score = nameSimilarity(left, right);
  if (score >= 0.5) reasons.push("name");

  if (brandMatches) {
    score = Math.min(1, score + 0.08);
    reasons.push("brand");
  }

  const model = compactCode(query.model);
  if (model.length >= 4) {
    const candidateModel = compactCode(candidate.model);
    if (candidateModel === model || compactCode(candidateText).includes(model)) {
      score = Math.max(score, brandMatches || !brand ? 0.95 : 0.85);
      reasons.unshift("model");
    } else if (candidateModel && candidateModel !== model) {
      // Same series, different model (WEG15929 vs WEG15919) is a different
      // product: never let it look like a confident match.
      score = Math.min(score, 0.55);
    }
  }

  // A barcode on both sides that differs means a different product.
  if (query.barcode && candidate.barcode && query.barcode !== candidate.barcode) {
    score = Math.min(score, 0.5);
  }

  return { score: Math.round(score * 100) / 100, reasons: [...new Set(reasons)] };
}

/** Scores, filters and orders candidates; best first, at most MAX_MATCHES. */
export function rankProductMatches<T extends MatchCandidate & { id: number }>(
  query: MatchQuery,
  candidates: T[],
): { product: T; score: number; reasons: MatchReason[] }[] {
  const seen = new Set<number>();
  return candidates
    .filter((c) => !seen.has(c.id) && seen.add(c.id))
    .map((product) => ({ product, ...scoreProductMatch(query, product) }))
    .filter((m) => m.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);
}

/**
 * Customer (lookup) mode opens a product straight away only when the match
 * is better than this — anything less goes to the "new product" review.
 */
export const AUTO_OPEN_MATCH_SCORE = 0.9;

/** What lookup mode should do with ranked matches (best first). */
export function decideLookup(matches: { product: { id: number }; score: number; reasons: MatchReason[] }[]): LookupOutcome {
  const top = matches[0];
  if (!top) return { kind: "new" };
  // A checksum-verified barcode is unambiguous, whatever else scored well.
  if (top.reasons.includes("barcode")) return { kind: "existing", productId: top.product.id };
  const confident = matches.filter((m) => m.score > AUTO_OPEN_MATCH_SCORE);
  if (confident.length === 0) return { kind: "new" };
  if (confident.length === 1) return { kind: "existing", productId: confident[0].product.id };
  return { kind: "choose", productIds: confident.map((m) => m.product.id) };
}
