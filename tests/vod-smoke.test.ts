// Why: end-to-end smoke for runVod with a fixture-backed stub repo so no real
// HTTP hits CI. Same pattern as tests/smoke.test.ts. Fixed Date ensures the
// expected verse is deterministic for the assertion.

import { describe, it, expect } from "bun:test";
import { runVod } from "@/cli/vod";
import { VERSE_POOL } from "@/cli/verse-pool-data";
import { pickVerseForDate } from "@/application/verse-pool";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Chapter } from "@/domain/passage";
import { makeTranslationId } from "@/domain/translations";

// Build a repo stub that returns a one-verse chapter matching whatever
// reference is requested. The verse text is unique per (book, chapter, verse)
// so we can assert what reached stdout.
const stubRepo: BibleRepository = {
  getChapter: async (_translation, book, chapter) => {
    // Return a chapter with verses 1..50 so any pool entry resolves.
    const verses = Array.from({ length: 50 }, (_, i) => ({
      number: i + 1,
      text: `STUB ${book} ${chapter}:${i + 1}`,
    }));
    return {
      ok: true,
      value: {
        translationId: makeTranslationId("BSB"),
        book,
        chapter,
        verses,
      } satisfies Chapter,
    };
  },
};

// Failing repo stub — simulates a network error from getChapter.
const failingRepo: BibleRepository = {
  getChapter: async () => ({
    ok: false,
    error: { kind: "network", message: "simulated failure" },
  }),
};

describe("smoke — verbum vod exit-1 path (repo failure)", () => {
  it("runVod returns 1 and writes network error to stderr when repo fails", async () => {
    const fixed = new Date("2026-01-15"); // any deterministic date

    let stderrCapture = "";
    let stdoutCapture = "";

    const origStderr = process.stderr.write.bind(process.stderr);
    const origStdout = process.stdout.write.bind(process.stdout);

    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrCapture += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      return true;
    }) as typeof process.stderr.write;

    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutCapture += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      return true;
    }) as typeof process.stdout.write;

    let exitCode: number;
    try {
      exitCode = await runVod(fixed, failingRepo);
    } finally {
      process.stderr.write = origStderr;
      process.stdout.write = origStdout;
    }

    expect(exitCode).toBe(1);
    expect(stderrCapture).toContain("network failure");
    // stdout must not contain verse content on failure
    expect(stdoutCapture).toBe("");
  });
});

describe("smoke — verbum vod happy path", () => {
  it("runVod with fixed Date prints the picked verse and exits 0", async () => {
    const fixed = new Date(2025, 2, 15); // Mar 15 → day 74 → VERSE_POOL[74]
    const expected = pickVerseForDate(fixed, VERSE_POOL);

    let captured = "";
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      return true;
    }) as typeof process.stdout.write;

    let exitCode: number;
    try {
      exitCode = await runVod(fixed, stubRepo);
    } finally {
      process.stdout.write = origWrite;
    }

    expect(exitCode).toBe(0);
    expect(captured).toContain(`STUB ${expected.usfm} ${expected.chapter}:${expected.verse}`);
  });

  it("runVod is deterministic — two calls on same date produce same stdout", async () => {
    const fixed = new Date(2025, 6, 4); // Jul 4

    const capture = async (): Promise<string> => {
      let buf = "";
      const orig = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((c: string | Uint8Array) => {
        buf += typeof c === "string" ? c : Buffer.from(c).toString();
        return true;
      }) as typeof process.stdout.write;
      try {
        await runVod(fixed, stubRepo);
      } finally {
        process.stdout.write = orig;
      }
      return buf;
    };

    const a = await capture();
    const b = await capture();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
