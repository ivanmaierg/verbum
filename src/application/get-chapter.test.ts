import { describe, it, expect } from "bun:test";
import { getChapter } from "./get-chapter";
import { makeBookId } from "@/domain/book-id";
import { DEFAULT_TRANSLATION_ID } from "@/domain/translations";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Reference } from "@/domain/reference";

function jhn3Ref(verseStart: number, verseEnd = verseStart): Reference {
  const book = makeBookId("JHN");
  if (!book.ok) throw new Error("test fixture: JHN must be valid");
  return { book: book.value, chapter: 3, verses: { start: verseStart, end: verseEnd } };
}

describe("getChapter", () => {
  it("returns the whole chapter regardless of ref.verses range", async () => {
    const ref = jhn3Ref(16);
    const repo: BibleRepository = {
      async getChapter() {
        return {
          ok: true,
          value: {
            translationId: DEFAULT_TRANSLATION_ID,
            book: ref.book,
            chapter: 3,
            verses: [
              { number: 1, text: "v1" },
              { number: 2, text: "v2" },
              { number: 16, text: "v16" },
            ],
          },
        };
      },
      async getTranslations() { return { ok: true, value: [] }; },
    };
    const result = await getChapter(repo, ref);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verses).toHaveLength(3);
    expect(result.value.reference).toEqual(ref);
  });

  it("propagates chapter_not_found", async () => {
    const ref = jhn3Ref(1);
    const repo: BibleRepository = {
      async getChapter() {
        return { ok: false, error: { kind: "chapter_not_found", chapter: 3 } };
      },
      async getTranslations() { return { ok: true, value: [] }; },
    };
    const result = await getChapter(repo, ref);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("chapter_not_found");
  });

  it("propagates network RepoError", async () => {
    const ref = jhn3Ref(1);
    const repo: BibleRepository = {
      async getChapter() {
        return { ok: false, error: { kind: "network", message: "down" } };
      },
      async getTranslations() { return { ok: true, value: [] }; },
    };
    const result = await getChapter(repo, ref);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("network");
  });
});
