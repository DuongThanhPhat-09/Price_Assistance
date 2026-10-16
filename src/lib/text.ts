/**
 * Text normalisation used by search.
 *
 * Shop owners type and speak without accents ("ong nuoc phi 27"), with
 * accents ("ống nước phi 27"), or with symbols ("Ø27"). Everything is folded
 * to the same lowercase ASCII token stream so all of those match.
 */

/** Removes Vietnamese (and other Latin) diacritics: "Ống nước" → "Ong nuoc". */
export function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Lowercase, accent-free, punctuation-free string with letter/digit
 * boundaries split: "Ổ cắm A12 (3m)" → "o cam a 12 3 m".
 */
export function normalizeText(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[øØ⌀φΦ]/g, " phi ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/(\d)[.,](\d)/g, "$1_$2") // keep decimals like 1.5 / 2,5 together
    .replace(/[^a-z0-9_]+/g, " ")
    .replace(/_/g, ".")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(input: string): string[] {
  const n = normalizeText(input);
  return n ? n.split(" ") : [];
}

/**
 * Filler words people say out loud when asking for a price. They are dropped
 * from a query (only when other words remain) so "giá ống nước phi 27 bao
 * nhiêu" searches for "ống nước phi 27".
 */
const FILLER_WORDS = new Set([
  // Vietnamese (accent-free). Careful: "co" (elbow fitting), "tien"
  // (Tiền Phong) and "minh" (Bình Minh) are product words, so not listed.
  "gia", "bao", "nhieu", "cho", "toi", "xem", "tim", "kiem",
  "loai", "khong", "nhe", "oi", "vay", "nao",
  // English
  "price", "of", "how", "much", "is", "for", "find", "show", "me", "please", "what",
]);

export function stripFillerWords(tokens: string[]): string[] {
  const kept = tokens.filter((t) => !FILLER_WORDS.has(t));
  return kept.length > 0 ? kept : tokens;
}

/** True when the token is purely numeric (e.g. "27", "1.5"). */
export function isNumericToken(token: string): boolean {
  return /^\d+(\.\d+)?$/.test(token);
}

/**
 * Damerau–Levenshtein distance (optimal string alignment) with an early exit
 * once `max` is exceeded. Short strings only — product name tokens.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[rows - 1][cols - 1];
}
