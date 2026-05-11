// Why: run() owns the exit-code contract so that src/index.tsx stays a
// one-liner entry point and tests can call run() directly without spawning
// a process — REQ-11.

import { parseArgs } from "util";
import { parseReference } from "@/domain/reference";
import { getPassage } from "@/application/get-passage";
import { createHelloAoBibleRepository } from "@/api/hello-ao-bible-repository";
import { renderParseError, renderRepoError, renderPassage } from "@/cli/render";
import { withLoading } from "@/cli/loading";
import { isRepoError } from "@/domain/errors";
import { runVod } from "@/cli/vod";

// run — exit-code contract:
//   0 → happy path, verse text on stdout
//   1 → repo error (network, schema, etc.), message on stderr
//   2 → parse error (unknown book, malformed input), message on stderr
export async function run(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
  });

  // Subcommand dispatch (I6, I7): check before parseReference. Any positional
  // that is NOT a recognised subcommand falls through unchanged.
  if (positionals[0] === "vod") {
    return await runVod(new Date());
  }

  const input = positionals.join(" ").trim();

  const refResult = parseReference(input);
  if (!refResult.ok) {
    process.stderr.write(renderParseError(refResult.error) + "\n");
    return 2;
  }

  const repo = createHelloAoBibleRepository();
  const passageResult = await withLoading(process.stderr, () => getPassage(repo, refResult.value));

  if (!passageResult.ok) {
    // AppError = ParseError | RepoError. ParseError was already handled above
    // via parseReference. Narrow via the type predicate — no unsafe cast (SG1).
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
