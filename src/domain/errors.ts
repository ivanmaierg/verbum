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

// REPO_ERROR_KINDS — exhaustive tuple so isRepoError stays in sync with RepoError — R5.
const REPO_ERROR_KINDS = [
  "network",
  "schema_mismatch",
  "translation_not_found",
  "book_not_found",
  "chapter_not_found",
  "verse_not_found",
] as const;

type RepoErrorKind = (typeof REPO_ERROR_KINDS)[number];

// isRepoError — type predicate so CLI layers can narrow AppError → RepoError
// without unsafe casts (SG1). A compile error fires here if RepoError gains a
// new kind that is missing from REPO_ERROR_KINDS — R5 exhaustiveness guarantee.
const _exhaustiveCheck: RepoError["kind"] extends RepoErrorKind ? true : never = true;
void _exhaustiveCheck;

export function isRepoError(err: AppError): err is RepoError {
  return (REPO_ERROR_KINDS as readonly string[]).includes(err.kind);
}
