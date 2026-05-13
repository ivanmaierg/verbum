// Why: the use case owns slicing (not the adapter) because the adapter port
// only takes (translationId, book, chapter) — it never sees the Reference —
// so slicing by verse range must happen here where Reference is in scope — ADR-DESIGN-1.

import type { Result } from "@/domain/result";
import type { Reference } from "@/domain/reference";
import type { Passage } from "@/domain/passage";
import type { AppError } from "@/domain/errors";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { TranslationId } from "@/domain/translations";

export async function getPassage(
  repo: BibleRepository,
  translationId: TranslationId,
  ref: Reference,
): Promise<Result<Passage, AppError>> {
  // 1. Fetch the whole chapter via the port.
  const chapterResult = await repo.getChapter(
    translationId,
    ref.book,
    ref.chapter,
  );

  // RepoError propagates unchanged — R12.
  if (!chapterResult.ok) return chapterResult;

  // 2. Slice by inclusive verse range (v1: start === end for single-verse refs).
  // Filtering by verse.number (not array index) handles non-contiguous numbering.
  const { start, end } = ref.verses;
  const sliced = chapterResult.value.verses.filter(
    (v) => v.number >= start && v.number <= end,
  );

  // 3. Empty slice → verse_not_found (Q-bonus, ADR-DESIGN-2).
  if (sliced.length === 0) {
    return { ok: false, error: { kind: "verse_not_found" } };
  }

  // 4. Wrap in a Passage and return.
  return {
    ok: true,
    value: { reference: ref, verses: sliced },
  };
}
