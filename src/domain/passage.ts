// Why: plain TypeScript types for the passage aggregate so that domain and
// application layers never import Zod — R4, R7.
// Verse is intentionally flat (number + text string) because the api adapter
// owns content-flattening before handing values to the domain.

import type { TranslationId } from "@/domain/translations";
import type { BookId } from "@/domain/book-id";
import type { Reference } from "@/domain/reference";

export type Verse = { number: number; text: string };

export type Chapter = {
  translationId: TranslationId;
  book: BookId;
  chapter: number;
  verses: Verse[];
};

// Passage is what the use case surfaces: a Reference resolved to its verse(s).
export type Passage = {
  reference: Reference;
  verses: Verse[];
};
