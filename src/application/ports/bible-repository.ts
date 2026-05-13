// Why: the port keeps the use case decoupled from HTTP — any implementation
// (HTTP adapter, in-memory stub, filesystem cache) can slot in without touching
// application logic — R3, R12.

import type { Result } from "@/domain/result";
import type { BookId } from "@/domain/book-id";
import type { Translation, TranslationId } from "@/domain/translations";
import type { Chapter } from "@/domain/passage";
import type { RepoError } from "@/domain/errors";

export interface BibleRepository {
  getChapter(
    translationId: TranslationId,
    book: BookId,
    chapter: number,
  ): Promise<Result<Chapter, RepoError>>;
  getTranslations(): Promise<Result<Translation[], RepoError>>;
}
