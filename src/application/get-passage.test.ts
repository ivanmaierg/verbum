import { describe, it, expect } from "bun:test";
import { getPassage } from "@/application/get-passage";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Reference } from "@/domain/reference";
import type { Chapter } from "@/domain/passage";
import { makeBookId } from "@/domain/book-id";
import { makeTranslationId } from "@/domain/translations";

// Helpers to build typed test values without bypassing the factory — R6.
function johnRef(verse: number): Reference {
  const book = makeBookId("JHN");
  if (!book.ok) throw new Error("test setup: JHN must be valid");
  return {
    book: book.value,
    chapter: 3,
    verses: { start: verse, end: verse },
  };
}

function makeChapter(verses: Array<{ number: number; text: string }>): Chapter {
  return {
    translationId: makeTranslationId("BSB"),
    book: (() => {
      const r = makeBookId("JHN");
      if (!r.ok) throw new Error("test setup");
      return r.value;
    })(),
    chapter: 3,
    verses,
  };
}

describe("getPassage", () => {
  it("happy path: returns the matching verse when the stub has it", async () => {
    const chapter = makeChapter([
      { number: 15, text: "Previous verse" },
      { number: 16, text: "For God so loved the world" },
      { number: 17, text: "Next verse" },
    ]);

    const stubRepo: BibleRepository = {
      getChapter: async () => ({ ok: true, value: chapter }),
    };

    const result = await getPassage(stubRepo, johnRef(16));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verses).toHaveLength(1);
    expect(result.value.verses[0]!.number).toBe(16);
    expect(result.value.verses[0]!.text).toContain("loved");
  });

  it("empty-slice: returns verse_not_found when chapter lacks the requested verse", async () => {
    const chapter = makeChapter([
      { number: 1, text: "Verse one" },
      { number: 2, text: "Verse two" },
    ]);

    const stubRepo: BibleRepository = {
      getChapter: async () => ({ ok: true, value: chapter }),
    };

    const result = await getPassage(stubRepo, johnRef(99));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("verse_not_found");
  });

  it("propagates RepoError when the repository fails", async () => {
    const stubRepo: BibleRepository = {
      getChapter: async () => ({
        ok: false,
        error: { kind: "network", message: "timeout" },
      }),
    };

    const result = await getPassage(stubRepo, johnRef(16));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("network");
  });
});
