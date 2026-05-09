// Why: formatting belongs in the CLI layer so that a future TUI can render the
// same error unions with colors and layout — ADR-DESIGN-3. Domain stays pure.
// All functions are pure (string → string); no IO in this file.

import type { ParseError, RepoError } from "@/domain/errors";
import type { Passage } from "@/domain/passage";

// renderParseError — exhaustive switch with a never fallthrough — R5, REQ-11.
// The unknown_book message MUST name the token so SCN-3 passes.
export function renderParseError(err: ParseError): string {
  switch (err.kind) {
    case "empty_input":
      return "Error: reference cannot be empty. Try: verbum john 3:16";
    case "unknown_book":
      return `Error: unknown book "${err.input}". Try a book name like "john" or "genesis".`;
    case "malformed_chapter_verse":
      return `Error: malformed chapter:verse "${err.input}". Expected format: <book> <chapter>:<verse> (e.g. john 3:16)`;
    case "out_of_range":
      return `Error: chapter ${err.chapter} exceeds maximum ${err.max} for this book.`;
    default: {
      // Exhaustiveness check — if a new ParseError variant is added, this line
      // becomes a type error at compile time (R5).
      const _exhaustive: never = err;
      throw new Error(`Unhandled ParseError kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function renderRepoError(err: RepoError): string {
  switch (err.kind) {
    case "network":
      return `Error: network failure — ${err.message}`;
    case "schema_mismatch":
      return `Error: unexpected API response — ${err.details}`;
    case "translation_not_found":
      return `Error: translation "${err.id}" not found.`;
    case "book_not_found":
      return `Error: book "${err.id}" not found in this translation.`;
    case "chapter_not_found":
      return `Error: chapter ${err.chapter} not found.`;
    case "verse_not_found":
      return "Error: verse not found in this chapter.";
    default: {
      const _exhaustive: never = err;
      throw new Error(`Unhandled RepoError kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function renderPassage(passage: Passage): string {
  // v1: single-verse; join all verses for future range support.
  return passage.verses.map((v) => v.text).join("\n");
}
