// Why: runVod owns the same exit-code contract as run() but for the vod
// subcommand — kept separate so run.ts stays a thin dispatcher.
// Mirrors run.ts's error-handling pattern exactly:
//   0 → verse on stdout
//   1 → repo error (network, etc.) on stderr
//   2 → makeBookId rejected pool entry on stderr (pool typo)

import { pickVerseForDate } from "@/application/verse-pool";
import { VERSE_POOL } from "@/cli/verse-pool-data";
import { makeBookId } from "@/domain/book-id";
import { getPassage } from "@/application/get-passage";
import { renderParseError, renderRepoError, renderPassage } from "@/cli/render";
import { withLoading } from "@/cli/loading";
import { createHelloAoBibleRepository } from "@/api/hello-ao-bible-repository";
import { DEFAULT_TRANSLATION_ID } from "@/domain/translations";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Reference } from "@/domain/reference";
import { isRepoError } from "@/domain/errors";

// Optional repo injection enables the smoke test to pass a fixture-backed stub
// without spawning a process or hitting the network — same pattern as run().
export async function runVod(
  date: Date,
  repo: BibleRepository = createHelloAoBibleRepository(),
): Promise<number> {
  const entry = pickVerseForDate(date, VERSE_POOL);

  // Construct BookId via the single factory (R6). A typo in pool data lands here.
  const bookResult = makeBookId(entry.usfm);
  if (!bookResult.ok) {
    process.stderr.write(renderParseError(bookResult.error) + "\n");
    return 2;
  }

  // Build Reference — single-verse range (start === end), v1 shape.
  const ref: Reference = {
    book: bookResult.value,
    chapter: entry.chapter,
    verses: { start: entry.verse, end: entry.verse },
  };

  const passageResult = await withLoading(process.stderr, () => getPassage(repo, DEFAULT_TRANSLATION_ID, ref));
  if (!passageResult.ok) {
    // AppError = ParseError | RepoError. Pool entries passed makeBookId so the
    // expected failures from getPassage are RepoErrors. Narrow via the type
    // predicate — no unsafe cast (SG1). A stale pool entry could in theory
    // produce a ParseError; render it correctly either way.
    const err = passageResult.error;
    if (isRepoError(err)) {
      process.stderr.write(renderRepoError(err) + "\n");
    } else {
      process.stderr.write(renderParseError(err) + "\n");
    }
    return 1;
  }

  process.stdout.write(renderPassage(passageResult.value) + "\n");
  return 0;
}
