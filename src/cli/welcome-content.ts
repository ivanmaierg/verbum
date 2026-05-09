// src/cli/welcome-content.ts — hardcoded welcome screen content constants (BSB text).
// Why here (not src/tui/): these constants are shared with future --version / --help CLI
// output per docs/ui-sketches.md. Placing under src/tui/ would force CLI to import from TUI.
// No other file in the codebase may define or duplicate these string values (REQ-7).

/** Genesis 1:1 — Berean Standard Bible (BSB) */
export const GENESIS_1_1_TEXT =
  "In the beginning God created the heavens and the earth.";

/** John 3:16 — Berean Standard Bible (BSB) */
export const JOHN_3_16_TEXT =
  "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.";

/** Version string displayed on the welcome screen book-frame. Not read from package.json at runtime. */
export const WELCOME_VERSION = "v0.1.0";
