import { BOOK_ALIASES } from "@/domain/reference";

export type BookSuggestion = {
  alias: string;
  canonical: string;
  displayName: string;
};

function toDisplayName(alias: string): string {
  const spaced = alias.replace(/^([123])([a-z])/, (_, num, letter) => `${num} ${letter.toUpperCase()}`);
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function longestAliasPerCanonical(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [alias, canonical] of Object.entries(BOOK_ALIASES)) {
    const existing = map.get(canonical);
    if (existing === undefined || alias.length > existing.length) {
      map.set(canonical, alias);
    }
  }
  return map;
}

const DISPLAY_NAMES: Map<string, string> = (() => {
  const longest = longestAliasPerCanonical();
  const result = new Map<string, string>();
  for (const [canonical, alias] of longest) {
    result.set(canonical, toDisplayName(alias));
  }
  return result;
})();

function isSubsequence(alias: string, q: string): boolean {
  let qi = 0;
  for (let ai = 0; ai < alias.length && qi < q.length; ai++) {
    if (alias[ai] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreAlias(alias: string, q: string): number {
  if (!isSubsequence(alias, q)) return -1;
  let score = 0;
  if (alias === q) score += 100;
  else if (alias.startsWith(q)) score += 50;
  score += (q.length / alias.length) * 30;
  return score;
}

export function suggestBooks(query: string, limit = 5): BookSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const scored: Array<{ alias: string; canonical: string; score: number }> = [];
  for (const [alias, canonical] of Object.entries(BOOK_ALIASES)) {
    const score = scoreAlias(alias, q);
    if (score >= 0) {
      scored.push({ alias, canonical, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ alias, canonical }) => ({
    alias,
    canonical,
    displayName: DISPLAY_NAMES.get(canonical) ?? toDisplayName(alias),
  }));
}
