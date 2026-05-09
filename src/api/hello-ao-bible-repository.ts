// Why: the factory pattern (not a class) satisfies R2 — repository as a plain
// object literal implementing the port interface. The try/catch is the single
// network boundary; everything inside returns Result — R12.

import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Chapter, Verse } from "@/domain/passage";
import type { BookId } from "@/domain/book-id";
import type { TranslationId } from "@/domain/translations";
import { RawChapterResponseSchema, RawVerseSchema } from "@/api/schemas";

// toVerseText — joins only string segments, strips { noteId } footnote refs.
// Option A from the proposal: footnotes are out of v1 scope — R8 (REQ-8).
// Not exported outside src/api/ — R4.
function toVerseText(items: Array<string | { noteId: number }>): string {
  return items
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .trim();
}

// createHelloAoBibleRepository — factory returning a BibleRepository object.
// Uses Bun's built-in fetch(); no third-party HTTP library (REQ-9).
export function createHelloAoBibleRepository(): BibleRepository {
  return {
    async getChapter(
      translationId: TranslationId,
      book: BookId,
      chapter: number,
    ) {
      try {
        const url = `https://bible.helloao.org/api/${translationId}/${book}/${chapter}.json`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 404) {
            return {
              ok: false,
              error: { kind: "chapter_not_found", chapter },
            };
          }
          return {
            ok: false,
            error: { kind: "network", message: `HTTP ${res.status}` },
          };
        }

        const json: unknown = await res.json();
        const parsed = RawChapterResponseSchema.safeParse(json);

        if (!parsed.success) {
          return {
            ok: false,
            error: {
              kind: "schema_mismatch",
              details: parsed.error.message,
            },
          };
        }

        // Filter chapter content to verse items only, then map to domain Verse.
        const verses: Verse[] = parsed.data.chapter.content
          .filter((item): item is typeof item & { type: "verse" } => {
            const verseCheck = RawVerseSchema.safeParse(item);
            return verseCheck.success;
          })
          .map((item) => {
            // Safe: filter above guarantees the item matches RawVerseSchema.
            const v = RawVerseSchema.parse(item);
            return {
              number: v.number,
              text: toVerseText(v.content),
            };
          });

        const result: Chapter = {
          translationId,
          book,
          chapter,
          verses,
        };

        return { ok: true, value: result };
      } catch (err) {
        return {
          ok: false,
          error: { kind: "network", message: String(err) },
        };
      }
    },
  };
}
