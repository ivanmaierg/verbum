// Why: the entry point stays minimal so TUI mode is a single if-statement here —
// no business logic lives in this file (REQ-12). argv.length === 0 routes to the
// TUI welcome screen; any positional args fall through to the existing CLI path (REQ-5).

import { run } from "./cli/run";
import { tuiDriver } from "./tui/tui-driver";

const argv = Bun.argv.slice(2);

if (argv.length === 0) {
  // No positional args → TUI welcome screen (SCN-1a, REQ-1).
  await tuiDriver();
  process.exit(0);
}

const exitCode = await run(argv);
process.exit(exitCode);
