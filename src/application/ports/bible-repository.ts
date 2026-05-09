// Why: the port keeps the use case decoupled from HTTP — any implementation
// (HTTP adapter, in-memory stub, filesystem cache) can slot in without touching
// application logic — R3, R12.

import type { Result } from "@/domain/result";
import type { BookId } from "@/domain/book-id";
import type { TranslationId } from "@/domain/translations";
import type { Chapter } from "@/domain/passage";
import type { RepoError } from "@/domain/errors";

// BibleRepository is the only port the v1 use cases depend on.
// v1 ships only getChapter; getTranslations and getBooks land in later slices.
export interface BibleRepository {
  getChapter(
    translationId: TranslationId,
    book: BookId,
    chapter: number,
  ): Promise<Result<Chapter, RepoError>>;
}
