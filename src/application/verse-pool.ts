// Why: the picker is application-layer because it operates on POJO pool entries
// — it does NOT take a BibleRepository, does NOT touch IO. Pool data lives in
// the CLI layer (it is config, not a domain concept), but the picking algorithm
// is reusable and testable in isolation here.

export type PoolEntry = {
  readonly usfm: string;
  readonly chapter: number;
  readonly verse: number;
};

// pickVerseForDate — pure. Same date → same entry. Size-agnostic via modulo.
// Determinism formula: dayOfYear(date) % pool.length.
export function pickVerseForDate(
  date: Date,
  pool: readonly PoolEntry[],
): PoolEntry {
  const idx = dayOfYear(date) % pool.length;
  // pool.length is 365 by invariant I1; pool[idx] is always defined.
  // Non-null assertion is local and justified — the alternative (Result) would
  // pollute every caller for a branch that cannot fire.
  return pool[idx]!;
}

// dayOfYear — 1-based day of the calendar year using LOCAL date components,
// computed via UTC arithmetic to avoid DST hour-shift jumps causing day skips.
// Jan 1 → 1, Dec 31 (non-leap) → 365, Dec 31 (leap) → 366.
export function dayOfYear(date: Date): number {
  const startUtc = Date.UTC(date.getFullYear(), 0, 1);
  const todayUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const MS_PER_DAY = 86_400_000;
  return Math.floor((todayUtc - startUtc) / MS_PER_DAY) + 1;
}
