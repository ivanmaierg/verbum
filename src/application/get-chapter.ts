import type { Result } from "@/domain/result";
import type { Reference } from "@/domain/reference";
import type { Passage } from "@/domain/passage";
import type { AppError } from "@/domain/errors";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { TranslationId } from "@/domain/translations";

export async function getChapter(
  repo: BibleRepository,
  translationId: TranslationId,
  ref: Reference,
): Promise<Result<Passage, AppError>> {
  const chapterResult = await repo.getChapter(
    translationId,
    ref.book,
    ref.chapter,
  );
  if (!chapterResult.ok) return chapterResult;
  return {
    ok: true,
    value: { reference: ref, verses: chapterResult.value.verses },
  };
}
