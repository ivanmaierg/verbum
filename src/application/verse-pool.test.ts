import { describe, it, expect } from "bun:test";
import { pickVerseForDate, dayOfYear } from "@/application/verse-pool";
import type { PoolEntry } from "@/application/verse-pool";
import { VERSE_POOL } from "@/cli/verse-pool-data";
import { makeBookId } from "@/domain/book-id";

// === C1: dayOfYear + picker tests use a fixture pool (Option B) ===
// Real-pool determinism tests and VERSE_POOL invariants land in C2
// alongside the actual data file, keeping this commit self-contained.

// Minimal stub pool — 365 distinct entries so modulo arithmetic is faithful.
// Each entry is a unique (chapter, verse) pair so referential inequality tests work.
const STUB_POOL: readonly PoolEntry[] = Array.from({ length: 365 }, (_, i) => ({
  usfm: "PSA",
  chapter: Math.floor(i / 10) + 1,
  verse: (i % 10) + 1,
}));

describe("dayOfYear", () => {
  it("Jan 1 → 1", () => expect(dayOfYear(new Date(2025, 0, 1))).toBe(1));
  it("Mar 15 (non-leap) → 74", () => expect(dayOfYear(new Date(2025, 2, 15))).toBe(74));
  it("Jul 4 (non-leap) → 185", () => expect(dayOfYear(new Date(2025, 6, 4))).toBe(185));
  it("Dec 31 (non-leap) → 365", () => expect(dayOfYear(new Date(2025, 11, 31))).toBe(365));
  it("Feb 29 (leap) → 60", () => expect(dayOfYear(new Date(2024, 1, 29))).toBe(60));
  it("Dec 31 (leap) → 366", () => expect(dayOfYear(new Date(2024, 11, 31))).toBe(366));
});

describe("pickVerseForDate — determinism (stub pool)", () => {
  it("same date twice → same entry (referentially equal)", () => {
    const a = pickVerseForDate(new Date(2025, 5, 15), STUB_POOL);
    const b = pickVerseForDate(new Date(2025, 5, 15), STUB_POOL);
    expect(a).toBe(b);
  });

  it("Jan 1 2025 → STUB_POOL[1] (day 1 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 0, 1), STUB_POOL)).toBe(STUB_POOL[1]);
  });

  it("Mar 15 2025 → STUB_POOL[74] (day 74 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 2, 15), STUB_POOL)).toBe(STUB_POOL[74]);
  });

  it("Jul 4 2025 → STUB_POOL[185] (day 185 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 6, 4), STUB_POOL)).toBe(STUB_POOL[185]);
  });

  it("Dec 31 2025 → STUB_POOL[0] (365 % 365 = 0, wrap)", () => {
    expect(pickVerseForDate(new Date(2025, 11, 31), STUB_POOL)).toBe(STUB_POOL[0]);
  });

  it("Dec 31 2024 (leap) → STUB_POOL[1] (366 % 365 = 1)", () => {
    expect(pickVerseForDate(new Date(2024, 11, 31), STUB_POOL)).toBe(STUB_POOL[1]);
  });

  it("day N+1 ≠ day N (variation)", () => {
    const a = pickVerseForDate(new Date(2025, 5, 15), STUB_POOL);
    const b = pickVerseForDate(new Date(2025, 5, 16), STUB_POOL);
    expect(a).not.toBe(b);
  });
});

// === C2: real VERSE_POOL invariants + determinism against real pool ===

describe("VERSE_POOL — invariants (I1, I2)", () => {
  it("I1: pool contains exactly 365 entries", () => {
    expect(VERSE_POOL.length).toBe(365);
  });

  it("I2: every entry's usfm is accepted by makeBookId", () => {
    for (const entry of VERSE_POOL) {
      const result = makeBookId(entry.usfm);
      if (!result.ok) {
        throw new Error(
          `Pool entry rejected: usfm="${entry.usfm}" ${entry.chapter}:${entry.verse}`,
        );
      }
    }
  });

  it("every entry has chapter >= 1 and verse >= 1", () => {
    for (const entry of VERSE_POOL) {
      expect(entry.chapter).toBeGreaterThanOrEqual(1);
      expect(entry.verse).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("pickVerseForDate — determinism (real VERSE_POOL)", () => {
  it("same date twice → same entry (referentially equal)", () => {
    const a = pickVerseForDate(new Date(2025, 5, 15), VERSE_POOL);
    const b = pickVerseForDate(new Date(2025, 5, 15), VERSE_POOL);
    expect(a).toBe(b);
  });

  it("Jan 1 2025 → VERSE_POOL[1] (day 1 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 0, 1), VERSE_POOL)).toBe(VERSE_POOL[1]);
  });

  it("Mar 15 2025 → VERSE_POOL[74] (day 74 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 2, 15), VERSE_POOL)).toBe(VERSE_POOL[74]);
  });

  it("Jul 4 2025 → VERSE_POOL[185] (day 185 % 365)", () => {
    expect(pickVerseForDate(new Date(2025, 6, 4), VERSE_POOL)).toBe(VERSE_POOL[185]);
  });

  it("Dec 31 2025 → VERSE_POOL[0] (365 % 365 = 0, wrap)", () => {
    expect(pickVerseForDate(new Date(2025, 11, 31), VERSE_POOL)).toBe(VERSE_POOL[0]);
  });

  it("Dec 31 2024 (leap) → VERSE_POOL[1] (366 % 365 = 1)", () => {
    expect(pickVerseForDate(new Date(2024, 11, 31), VERSE_POOL)).toBe(VERSE_POOL[1]);
  });

  it("day N+1 ≠ day N (variation)", () => {
    const a = pickVerseForDate(new Date(2025, 5, 15), VERSE_POOL);
    const b = pickVerseForDate(new Date(2025, 5, 16), VERSE_POOL);
    expect(a).not.toBe(b);
  });
});
