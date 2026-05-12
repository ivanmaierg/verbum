// Why: a branded BookId prevents raw strings from reaching the API without
// passing through the alias map — R6. The single `as BookId` cast lives here;
// all callers use makeBookId (review-blocker otherwise).
//
// Note: the factory returns UnknownBookError { kind: "unknown_book" } rather
// than InvalidBookError { kind: "invalid_book" } because "unknown_book" matches
// the ParseError vocabulary the user sees — consistency over house-rules example.

import type { Result } from "@/domain/result";
import type { UnknownBookError } from "@/domain/errors";

export type BookId = string & { readonly __brand: "BookId" };

// Full 66-book USFM canonical set (Old + New Testaments).
// IDs match helloao API book paths exactly — no translation layer needed.
const CANONICAL = new Set<string>([
  // Old Testament
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT",
  "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH",
  "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER",
  "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON",
  "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
  // New Testament
  "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO",
  "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI",
  "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN",
  "3JN", "JUD", "REV",
]);

export function makeBookId(s: string): Result<BookId, UnknownBookError> {
  if (!CANONICAL.has(s)) {
    return { ok: false, error: { kind: "unknown_book", input: s } };
  }
  return { ok: true, value: s as BookId }; // the only `as BookId` cast — R6
}

export function bookIdFromCanonical(canonical: string): BookId {
  const result = makeBookId(canonical);
  if (!result.ok) throw new Error(`bookIdFromCanonical: unknown book "${canonical}"`);
  return result.value;
}
