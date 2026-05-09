// Why: the entry point stays a one-liner so that adding TUI mode later is a
// single if-statement here — no business logic lives in this file — REQ-12.

import { run } from "./cli/run";

const argv = Bun.argv.slice(2);

if (argv.length === 0) {
  // No positional args → usage error. parseReference is NOT called — SCN-5.
  process.stderr.write("Usage: verbum <reference> (e.g., verbum john 3:16)\n");
  process.exit(2);
}

const exitCode = await run(argv);
process.exit(exitCode);
