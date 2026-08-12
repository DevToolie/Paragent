/**
 * Text normalization for intent matching (issue #124).
 *
 * One rule, applied identically to a catalog description and an incoming
 * query, so "the same rule on both sides" is the only thing that has to be
 * true for exact matching to work. The rule, in order:
 *
 * 1. Unicode-normalize (`NFKC`) so visually identical strings compare equal
 *    regardless of composed/decomposed form.
 * 2. Lowercase.
 * 3. Strip everything that is not a letter, a number, or whitespace —
 *    punctuation, symbols, emoji. `"create a stat dashboard, from testdata!"`
 *    and `"create a stat dashboard from testdata"` must normalize the same.
 * 4. Collapse runs of whitespace to a single space and trim the ends.
 *
 * Deliberately does **not**: stem or lemmatize, drop stopwords, or reorder
 * words. Any of those would turn "exact normalized match" into a fuzzy
 * matcher wearing an exact matcher's name, which is precisely the permissive
 * behavior issue #124 item 3 warns against — a near-miss that resolves
 * confidently instead of missing loudly.
 */

/** The one normalization rule every matcher and every catalog entry uses. */
export function normalizeIntentText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
