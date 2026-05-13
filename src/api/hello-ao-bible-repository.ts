// Why: the factory pattern (not a class) satisfies R2 — repository as a plain
// object literal implementing the port interface. The try/catch is the single
// network boundary; everything inside returns Result — R12.

import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Chapter, Verse } from "@/domain/passage";
import type { Translation } from "@/domain/translations";
import type { BookId } from "@/domain/book-id";
import type { TranslationId } from "@/domain/translations";
import { makeTranslationId } from "@/domain/translations";
import { RawChapterResponseSchema, RawVerseSchema, RawTranslationsResponseSchema } from "@/api/schemas";

// toVerseText — joins only string segments, strips { noteId } footnote refs.
// Option A from the proposal: footnotes are out of v1 scope — R8 (REQ-8).
// Not exported outside src/api/ — R4.
function toVerseText(items: Array<string | { noteId: number }>): string {
  return items
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .trim();
}

const TRANSLATIONS_ENDPOINT = "https://bible.helloao.org/api/available_translations.json";

// createHelloAoBibleRepository — factory returning a BibleRepository object.
// Uses Bun's built-in fetch(); no third-party HTTP library (REQ-9).
export function createHelloAoBibleRepository(): BibleRepository {
  let cached: Translation[] | null = null;

  return {
    async getTranslations() {
      if (cached !== null) return { ok: true, value: cached };
      try {
        const res = await fetch(TRANSLATIONS_ENDPOINT);
        if (!res.ok) {
          return { ok: false, error: { kind: "network", message: `HTTP ${res.status}` } };
        }
        const json: unknown = await res.json();
        const parsed = RawTranslationsResponseSchema.safeParse(json);
        if (!parsed.success) {
          return { ok: false, error: { kind: "schema_mismatch", details: parsed.error.message } };
        }
        const translations: Translation[] = parsed.data.translations
          .map((raw) => ({
            id: makeTranslationId(raw.id),
            name: raw.name,
            language: raw.language,
            languageEnglishName: raw.englishName,
            textDirection: raw.textDirection,
          }))
          .sort((a, b) => {
            const lang = a.languageEnglishName.localeCompare(b.languageEnglishName);
            return lang !== 0 ? lang : a.name.localeCompare(b.name);
          });
        cached = translations;
        return { ok: true, value: translations };
      } catch (err) {
        return { ok: false, error: { kind: "network", message: String(err) } };
      }
    },

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

        const verses: Verse[] = parsed.data.chapter.content.flatMap((item) => {
          const verseCheck = RawVerseSchema.safeParse(item);
          if (!verseCheck.success) return [];
          return [{
            number: verseCheck.data.number,
            text: toVerseText(verseCheck.data.content),
          }];
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
