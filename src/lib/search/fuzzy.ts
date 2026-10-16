import { editDistance, isNumericToken, normalizeText, stripFillerWords, tokenize } from "../text";

/**
 * Small, dependency-free fuzzy matcher tuned for product names.
 *
 * - accent-insensitive ("ong nuoc" ≈ "Ống nước")
 * - prefix matching while typing ("pan" → "Panasonic")
 * - typo tolerant for longer words ("panasonik" → "Panasonic")
 * - numbers must match exactly or by prefix ("27" never matches "21")
 * - multi-word queries rank items that match *every* word highest
 *
 * It is pure (no I/O) so it runs on the server today and could run in the
 * browser for an offline mode later.
 */

export interface SearchableFields {
  name: string;
  category?: string | null;
  barcode?: string | null;
  description?: string | null;
  shelfLocation?: string | null;
}

interface IndexedField {
  tokens: string[];
  weight: number;
  isName?: boolean;
}

export interface IndexedDoc<T> {
  item: T;
  fields: IndexedField[];
  nameNorm: string;
  barcode: string | null;
}

export interface ScoredResult<T> {
  item: T;
  score: number;
}

const FIELD_WEIGHTS = {
  name: 3,
  category: 1.5,
  shelfLocation: 1,
  description: 0.6,
} as const;

export function buildIndex<T>(items: T[], pick: (item: T) => SearchableFields): IndexedDoc<T>[] {
  return items.map((item) => {
    const f = pick(item);
    const fields: IndexedField[] = [
      { tokens: tokenize(f.name), weight: FIELD_WEIGHTS.name, isName: true },
      { tokens: tokenize(f.category ?? ""), weight: FIELD_WEIGHTS.category },
      { tokens: tokenize(f.shelfLocation ?? ""), weight: FIELD_WEIGHTS.shelfLocation },
      { tokens: tokenize(f.description ?? ""), weight: FIELD_WEIGHTS.description },
    ].filter((x) => x.tokens.length > 0);
    return {
      item,
      fields,
      nameNorm: normalizeText(f.name),
      barcode: f.barcode?.trim() || null,
    };
  });
}

/** How well a single query token matches a single document token (0..1). */
export function tokenMatch(q: string, t: string): number {
  if (q === t) return 1;
  const qNum = isNumericToken(q);
  if (t.startsWith(q)) return qNum ? 0.6 : 0.85;
  if (qNum || isNumericToken(t)) return 0;
  if (q.length >= 3 && t.includes(q)) return 0.55;
  if (q.length >= 4) {
    const max = q.length >= 7 ? 2 : 1;
    const d = editDistance(q, t, max); // returns max+1 when "too far"
    if (d === 1) return 0.6;
    if (d === 2 && max >= 2) return 0.4;
    // Typo while still typing: compare against the start of the word.
    if (t.length > q.length && editDistance(q, t.slice(0, q.length), 1) === 1) return 0.45;
  }
  return 0;
}

function scoreDoc<T>(doc: IndexedDoc<T>, qTokens: string[], phrase: string): number {
  let sum = 0;
  let matched = 0;
  let matchedInName = 0;
  for (const q of qTokens) {
    let best = 0;
    let inName = false;
    for (const field of doc.fields) {
      for (const t of field.tokens) {
        const m = tokenMatch(q, t);
        if (m > 0 && field.isName) inName = true;
        const s = m * field.weight;
        if (s > best) best = s;
      }
    }
    if (best > 0) matched++;
    if (inName) matchedInName++;
    sum += best;
  }
  if (matched === 0) return 0;
  const coverage = matched / qTokens.length;
  if (qTokens.length > 1 && coverage < 0.5) return 0;

  let score = sum * coverage * coverage;
  // Every word appears in the product name itself (not just its category).
  if (qTokens.length > 1 && matchedInName === qTokens.length) score += 3;
  if (phrase && doc.nameNorm.includes(phrase)) score += 2;
  if (phrase && doc.nameNorm.startsWith(phrase)) score += 1;
  return score;
}

const MIN_RELATIVE_SCORE = 0.2;

export function fuzzySearch<T>(
  index: IndexedDoc<T>[],
  query: string,
  limit = 20,
): ScoredResult<T>[] {
  const compact = query.replace(/\s+/g, "");
  const qTokens = stripFillerWords(tokenize(query));
  if (qTokens.length === 0) return [];
  const phrase = qTokens.join(" ");
  const looksLikeBarcode = /^\d{4,}$/.test(compact);

  const results: { doc: IndexedDoc<T>; score: number }[] = [];
  for (const doc of index) {
    let score = 0;
    if (looksLikeBarcode && doc.barcode) {
      if (doc.barcode === compact) score = 1000;
      else if (doc.barcode.startsWith(compact)) score = 50;
    }
    if (score === 0) score = scoreDoc(doc, qTokens, phrase);
    if (score > 0) results.push({ doc, score });
  }

  if (results.length === 0) return [];
  // Drop weak tail matches (e.g. one fuzzy word out of three) so the list
  // only shows things worth looking at. Ties: shorter, simpler names first.
  const top = Math.max(...results.map((r) => r.score));
  return results
    .filter((r) => r.score >= top * MIN_RELATIVE_SCORE)
    .sort((a, b) => b.score - a.score || a.doc.nameNorm.length - b.doc.nameNorm.length)
    .slice(0, limit)
    .map((r) => ({ item: r.doc.item, score: r.score }));
}

/**
 * Decides whether a result list is unambiguous enough to open the top
 * product straight away (used by voice search: "no extra click").
 */
export function pickConfidentMatch<T>(results: ScoredResult<T>[], ratio = 1.25): T | null {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0].item;
  const [first, second] = results;
  return first.score >= second.score * ratio ? first.item : null;
}
