// Why: centralises all discriminated error unions so every layer can import
// the exact variant it needs without touching unrelated concerns — R5.
// Each union uses `kind` for exhaustiveness checks and Go-port symmetry.

export type UnknownBookError = { kind: "unknown_book"; input: string };

export type ParseError =
  | { kind: "empty_input" }
  | { kind: "unknown_book"; input: string }
  | { kind: "malformed_chapter_verse"; input: string }
  | { kind: "out_of_range"; chapter: number; max: number };

export type RepoError =
  | { kind: "network"; message: string }
  | { kind: "schema_mismatch"; details: string }
  | { kind: "translation_not_found"; id: string }
  | { kind: "book_not_found"; id: string }
  | { kind: "chapter_not_found"; chapter: number }
  | { kind: "verse_not_found" };

// AppError is the union that use cases surface to presentation — R5.
export type AppError = ParseError | RepoError;
