import type { Result } from "@/domain/result";
import type { Reference } from "@/domain/reference";
import type { Passage } from "@/domain/passage";
import type { AppError } from "@/domain/errors";
import type { BibleRepository } from "@/application/ports/bible-repository";
import { DEFAULT_TRANSLATION_ID } from "@/domain/translations";

export async function getChapter(
  repo: BibleRepository,
  ref: Reference,
): Promise<Result<Passage, AppError>> {
  const chapterResult = await repo.getChapter(
    DEFAULT_TRANSLATION_ID,
    ref.book,
    ref.chapter,
  );
  if (!chapterResult.ok) return chapterResult;
  return {
    ok: true,
    value: { reference: ref, verses: chapterResult.value.verses },
  };
}
