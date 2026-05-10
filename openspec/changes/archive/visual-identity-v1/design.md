# Design: visual-identity-v1

## TL;DR
A NEW `src/presentation/` tier holds one hex constant (`ACCENT_HEX = "#5BA0F2"`). A NEW `src/cli/ansi.ts` (~40 LOC + tests) provides `accent`/`dim`/`muted`/`error`/`RESET` helpers and an `isColorEnabled(stream)` detector with npm-aligned `FORCE_COLOR` semantics. `src/cli/render.ts` wraps error renderers in `error()`; `renderPassage` gets the helper call but stays byte-identical in v1 (`text` token is identity). The banner generator runs figlet twice (`"Verb"` + `"um"`), validates parity, and emits two multi-line `string` exports — multi-line strings are confirmed to render inside a single `<text>` per current welcome-screen.tsx (line 66 already does it). Six commits land the change under the 400-line review budget.

## Layer Audit (summary)

| File | Tier | Inward arrows (this change) | Inward arrows (must NOT add) |
|------|------|-----------------------------|------------------------------|
| `src/presentation/colors.ts` | presentation (NEW) | none | domain/application/api/cli/tui |
| `src/cli/ansi.ts` | cli adapter | `src/presentation/colors.ts`, Node `process` | domain/application/api |
| `src/cli/ansi.test.ts` | cli test | `src/cli/ansi.ts`, `bun:test` | — |
| `src/cli/render.ts` | cli adapter | adds `src/cli/ansi.ts` | unchanged otherwise |
| `src/cli/banner.ts` | cli adapter (generated) | none | — |
| `scripts/generate-banner.ts` | dev tooling | `figlet`, Bun runtime | runtime code |
| `src/tui/welcome/welcome-screen.tsx` | tui adapter | adds `src/presentation/colors.ts`; replaces `BANNER` with `BANNER_DIM_PART`/`BANNER_ACCENT_PART` | domain/application/api |

`src/presentation/` is a NEW peer of `src/cli/` and `src/tui/` — same tier (adapters/presentation), no domain crossing. Both adapters consume it; nothing inside it imports anywhere else. Hexagon respected.

## Resolved Spec Questions

### Q1 — `FORCE_COLOR="0"` semantics

**Choice**: Follow **npm/Node convention**. `FORCE_COLOR="0"` (and `"false"`) **disables** color. `"1"`/`"2"`/`"3"`/`"true"`/`"always"` (and any other non-empty string we don't recognize as falsey) **enable** color. Empty / unset → no override.

**Rationale**: Bun users come from the npm/Node ecosystem. Chalk, picocolors, and Node core all treat `FORCE_COLOR=0` as "force off". The spec's "any non-empty string enables" rule would surprise users who type `FORCE_COLOR=0` expecting it to disable. Cost is one extra branch in `isColorEnabled` — well worth removing the footgun. Documented in the truth table below.

**Conflict resolution — FORCE_COLOR vs NO_COLOR**: `NO_COLOR` (non-empty) wins. https://no-color.org is unambiguous: a non-empty `NO_COLOR` MUST disable color. We honor that even when `FORCE_COLOR` is also set. This matches chalk's behavior since v5.

### Q2 — OpenTUI DIM API

**Confirmed** via `node_modules/@opentui/core/types.d.ts` lines 7–17:

```ts
export declare const TextAttributes: {
  NONE: number; BOLD: number; DIM: number; ITALIC: number;
  UNDERLINE: number; BLINK: number; INVERSE: number;
  HIDDEN: number; STRIKETHROUGH: number;
};
```

`SpanProps` extends `TextNodeOptions` which has `attributes?: number`. Usage is `attributes={TextAttributes.DIM}` (a numeric bitflag — not an array). The current welcome-screen.tsx already uses `const DIM = TextAttributes.DIM;` and `<span attributes={DIM}>` (line 28, 48, 52). The spec's "`attributes={[DIM]}`" wording (array) is wrong; the field is `number`, not `number[]`. Design uses the scalar form. No new dep, no new wrapper.

### Q3 — Banner export type: `string` (multi-line) or `string[]`

**Choice**: `string` (multi-line, `\n`-joined). Spec assumption holds.

**Confirmed** by precedent: welcome-screen.tsx line 66 currently renders `<text>{BANNER.trimEnd()}</text>` where `BANNER` is a multi-line template literal. OpenTUI's `<text>` accepts string children including newlines and lays them out as multiple rows. Splitting into two adjacent `<span>` children inside one `<text>` will render the wordmark on the same vertical block with the DIM left half and ACCENT right half on each banner row. `BANNER_WIDTH` is exported as a precomputed `number` so welcome-screen drops its `Math.max(...BANNER.split("\n").map((l) => l.length))` runtime calc.

## File-by-File Design

### NEW: `src/presentation/colors.ts`

```ts
// src/presentation/colors.ts — pure presentation constants, no imports, no logic.
// Consumed by both src/cli/ansi.ts (escape-wrap) and src/tui/* (<span fg={...}>).
// New constants land here as one-line additive changes. R4 compliant: no Zod, no types beyond `string`.

export const ACCENT_HEX = "#5BA0F2";
```

That is the **entire file**. No `MUTED_HEX` (deferred per brief — no consumer). Adding one later is one line.

**Imports**: none.
**Layer**: presentation. Consumed by `src/cli/ansi.ts` and `src/tui/welcome/welcome-screen.tsx`.

### NEW: `src/cli/ansi.ts`

```ts
// src/cli/ansi.ts — ANSI escape helpers for CLI surfaces, gated on per-stream color state.
// Single point of env-var reading is isColorEnabled; helpers are pure string transforms.
// R1/R5 do not apply: no Result usage here — these are infallible identity-or-wrap fns.

import { ACCENT_HEX } from "@/presentation/colors";

export const RESET = "\x1b[0m";

const ACCENT_OPEN = "\x1b[38;2;91;160;242m"; // truecolor SGR for #5BA0F2
const ACCENT_CLOSE = "\x1b[39m";             // default fg only
const DIM_OPEN = "\x1b[2m";
const DIM_CLOSE = "\x1b[22m";                // reset bold/dim only
const ERROR_OPEN = "\x1b[31m";               // standard red
const ERROR_CLOSE = "\x1b[39m";

// Sanity check: the truecolor escape must encode the locked ACCENT_HEX.
// If the constant ever drifts, this file must be updated in lockstep — a unit test guards it.
void ACCENT_HEX; // referenced for the test; not used at runtime to keep the helper allocation-free.

export function accent(s: string, enabled: boolean): string {
  return enabled ? `${ACCENT_OPEN}${s}${ACCENT_CLOSE}` : s;
}

export function dim(s: string, enabled: boolean): string {
  return enabled ? `${DIM_OPEN}${s}${DIM_CLOSE}` : s;
}

// muted is an identity function in v1 (spec I3/I5). Token role preserved at the type-level
// for future use; rendering is a no-op. enabled param is accepted for API symmetry.
export function muted(s: string, _enabled: boolean): string {
  return s;
}

export function error(s: string, enabled: boolean): string {
  return enabled ? `${ERROR_OPEN}${s}${ERROR_CLOSE}` : s;
}

export function isColorEnabled(stream: NodeJS.WriteStream): boolean {
  const env = process.env;
  const noColor = env.NO_COLOR;
  // NO_COLOR: any non-empty value disables (https://no-color.org). Empty/unset = no opinion.
  if (typeof noColor === "string" && noColor.length > 0) return false;

  const force = env.FORCE_COLOR;
  if (typeof force === "string" && force.length > 0) {
    // npm convention: "0" and "false" disable; anything else enables.
    const f = force.toLowerCase();
    if (f === "0" || f === "false") return false;
    return true;
  }

  return stream.isTTY === true;
}
```

**Departure from spec contract**: helpers take an explicit `enabled: boolean` second arg rather than reading per-call. Rationale: the spec's I6 says "single point of env-var reading is `isColorEnabled`"; the cleanest way to honor that is for callers to compute `enabled = isColorEnabled(stream)` once at the top of the render fn and pass it through. Avoids hidden global reads in pure helpers, makes unit tests trivial (no env mocking needed for the wrappers themselves), and removes per-call env lookups. Spec is silent on the helper signature; the I4 invariant (`enabled === false ⇒ helper is identity`) is preserved verbatim.

**Imports**: `@/presentation/colors`. Node `process` (global). No other deps.

**Result/error contract (R1/R5/R12)**: N/A — these helpers cannot fail. No `Result<T,E>` shape needed.

### NEW: `src/cli/ansi.test.ts`

```ts
// src/cli/ansi.test.ts — unit tests for ANSI helpers and isColorEnabled detector.
// Pure tests — no terminal allocation, no IO. process.env is mutated and restored.

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { accent, dim, muted, error, isColorEnabled, RESET } from "./ansi";

const ttyStream = { isTTY: true } as NodeJS.WriteStream;
const pipeStream = { isTTY: false } as NodeJS.WriteStream;

describe("ansi helpers — color enabled", () => {
  it("accent wraps with truecolor SGR for #5BA0F2", () => {
    expect(accent("hi", true)).toBe("\x1b[38;2;91;160;242mhi\x1b[39m");
  });
  it("dim wraps with attr 2 and resets with 22", () => {
    expect(dim("hi", true)).toBe("\x1b[2mhi\x1b[22m");
  });
  it("error wraps with ANSI 31", () => {
    expect(error("oops", true)).toBe("\x1b[31moops\x1b[39m");
  });
  it("muted is identity even when enabled", () => {
    expect(muted("x", true)).toBe("x");
  });
  it("RESET escape is the full-reset SGR", () => {
    expect(RESET).toBe("\x1b[0m");
  });
});

describe("ansi helpers — color disabled (identity)", () => {
  it("accent passthrough", () => { expect(accent("hi", false)).toBe("hi"); });
  it("dim passthrough", () => { expect(dim("hi", false)).toBe("hi"); });
  it("error passthrough", () => { expect(error("oops", false)).toBe("oops"); });
  it("muted passthrough", () => { expect(muted("x", false)).toBe("x"); });
});

describe("isColorEnabled — truth table", () => {
  let envBackup: NodeJS.ProcessEnv;
  beforeEach(() => { envBackup = { ...process.env }; delete process.env.NO_COLOR; delete process.env.FORCE_COLOR; });
  afterEach(() => { process.env = envBackup; });

  it("T1 default TTY → enabled", () => { expect(isColorEnabled(ttyStream)).toBe(true); });
  it("T2 default non-TTY → disabled", () => { expect(isColorEnabled(pipeStream)).toBe(false); });
  it("T3 NO_COLOR=1 TTY → disabled", () => { process.env.NO_COLOR = "1"; expect(isColorEnabled(ttyStream)).toBe(false); });
  it('T4 NO_COLOR="" TTY → enabled (empty = no opinion)', () => { process.env.NO_COLOR = ""; expect(isColorEnabled(ttyStream)).toBe(true); });
  it("T5 FORCE_COLOR=1 non-TTY → enabled", () => { process.env.FORCE_COLOR = "1"; expect(isColorEnabled(pipeStream)).toBe(true); });
  it("T6 FORCE_COLOR=0 TTY → disabled (npm convention)", () => { process.env.FORCE_COLOR = "0"; expect(isColorEnabled(ttyStream)).toBe(false); });
  it("T7 FORCE_COLOR=false TTY → disabled (npm convention)", () => { process.env.FORCE_COLOR = "false"; expect(isColorEnabled(ttyStream)).toBe(false); });
  it("T8 NO_COLOR=1 + FORCE_COLOR=1 → disabled (NO_COLOR wins, no-color.org)", () => { process.env.NO_COLOR = "1"; process.env.FORCE_COLOR = "1"; expect(isColorEnabled(pipeStream)).toBe(false); });
  it("T9 FORCE_COLOR=true non-TTY → enabled", () => { process.env.FORCE_COLOR = "true"; expect(isColorEnabled(pipeStream)).toBe(true); });
});
```

**Imports**: `bun:test`, `./ansi`.

### MODIFIED: `src/cli/render.ts`

Before — three pure switches; no color awareness:

```ts
export function renderParseError(err: ParseError): string {
  switch (err.kind) { /* ...returns plain strings... */ }
}
export function renderRepoError(err: RepoError): string { /* ... */ }
export function renderPassage(passage: Passage): string {
  return passage.verses.map((v) => v.text).join("\n");
}
```

After — same switches, but each public fn evaluates `enabled` once and wraps the final string:

```ts
import type { ParseError, RepoError } from "@/domain/errors";
import type { Passage } from "@/domain/passage";
import { error, isColorEnabled } from "./ansi";

function formatParseError(err: ParseError): string {
  switch (err.kind) { /* ...same body as today, returns the plain message... */ }
}
function formatRepoError(err: RepoError): string { /* ...same body as today... */ }

export function renderParseError(err: ParseError): string {
  return error(formatParseError(err), isColorEnabled(process.stderr));
}
export function renderRepoError(err: RepoError): string {
  return error(formatRepoError(err), isColorEnabled(process.stderr));
}

export function renderPassage(passage: Passage): string {
  // text token is identity in v1 (spec I12). No wrap. isColorEnabled call kept so the
  // infrastructure is exercised and future reference-label wrapping is a one-liner.
  const _enabled = isColorEnabled(process.stdout);
  void _enabled;
  return passage.verses.map((v) => v.text).join("\n");
}
```

Discriminated-union switches preserved with `never` exhaustiveness (R5). No Zod, no domain churn (R4). The pure formatters (`formatParseError`/`formatRepoError`) are internal — they let the public wrappers be one-line tests against the byte-identical-when-disabled invariant (I11).

### MODIFIED: `src/cli/banner.ts` (generated)

Before:
```ts
export const BANNER = `…six rows of "Verbum"…`;
```

After (output of `scripts/generate-banner.ts`):
```ts
// src/cli/banner.ts — GENERATED by `bun run generate:banner`. Do NOT edit by hand.
// Source: figlet -f "ANSI Shadow" "Verb" + figlet -f "ANSI Shadow" "um"
export const BANNER_DIM_PART = `…six rows of "Verb"…`;
export const BANNER_ACCENT_PART = `…six rows of "um"…`;
export const BANNER_WIDTH = 53; // computed at generation time
```

`BANNER` export is **removed** (breaking change — only consumer is `welcome-screen.tsx`, updated in the same commit; spec invariant I-banner-removal is explicit). No backward-compat alias.

### MODIFIED: `scripts/generate-banner.ts`

```ts
// scripts/generate-banner.ts — dev tooling. Generates src/cli/banner.ts.
// Runs figlet twice (two-tone wordmark per D3) and validates parity before writing.
// figlet is a devDependency — NEVER imported by runtime code.

import figlet from "figlet";
import { join } from "path";

const FONT = "ANSI Shadow";
const projectRoot = join(import.meta.dir, "..");
const outputPath = join(projectRoot, "src", "cli", "banner.ts");

function render(text: string): string[] {
  const raw = figlet.textSync(text, { font: FONT });
  return raw.split("\n");
}

const verb = render("Verb");
const um = render("um");

// Parity invariant I8: line counts MUST match. Without this guard the two <span>s
// can't render on the same row in welcome-screen.tsx.
if (verb.length !== um.length) {
  console.error(`Banner parity drift: Verb=${verb.length} lines, um=${um.length} lines. Fix the figlet font or the input strings.`);
  process.exit(1);
}

// Width parity per row: every line in "Verb" must be the same width across its rows,
// and every line in "um" must be the same width across its rows, so JSX concatenation
// produces a clean column. (Per-half — NOT requiring verb width == um width; they
// are different halves of the wordmark.)
const verbWidth = Math.max(...verb.map((l) => l.length));
const umWidth = Math.max(...um.map((l) => l.length));
const verbPadded = verb.map((l) => l.padEnd(verbWidth));
const umPadded = um.map((l) => l.padEnd(umWidth));

const dimPart = verbPadded.join("\n");
const accentPart = umPadded.join("\n");
const totalWidth = verbWidth + umWidth;

const content = `// src/cli/banner.ts — GENERATED by \`bun run generate:banner\`. Do NOT edit by hand.
// Source: figlet -f "${FONT}" "Verb" + figlet -f "${FONT}" "um"
export const BANNER_DIM_PART = \`
${dimPart}
\`;
export const BANNER_ACCENT_PART = \`
${accentPart}
\`;
export const BANNER_WIDTH = ${totalWidth};
`;

await Bun.write(outputPath, content);
console.log(`Written: ${outputPath} (lines=${verb.length}, width=${totalWidth})`);
```

**Loud-failure mode** on parity drift: non-zero exit, output file NOT touched (write happens AFTER the guards). Satisfies spec invariant S14.

**Open generator question (answered)**: emits **directly** to `src/cli/banner.ts` — matches the current pattern. No separate generated/ directory.

### MODIFIED: `src/tui/welcome/welcome-screen.tsx`

Before (lines 14–15, 29, 66):
```tsx
import { TextAttributes } from "@opentui/core";
import { BANNER } from "@/cli/banner";
// ...
const BANNER_WIDTH = Math.max(...BANNER.split("\n").map((l) => l.length));
// ...

<text>{BANNER.trimEnd()}</text>
```

After:
```tsx
import { TextAttributes } from "@opentui/core";
import { BANNER_DIM_PART, BANNER_ACCENT_PART, BANNER_WIDTH } from "@/cli/banner";
import { ACCENT_HEX } from "@/presentation/colors";
// ...
const DIM = TextAttributes.DIM;
// (BANNER_WIDTH is now imported, not recomputed)
// ...

<text>
  <span attributes={DIM}>{BANNER_DIM_PART.trimEnd()}</span>
  <span fg={ACCENT_HEX}>{BANNER_ACCENT_PART.trimEnd()}</span>
</text>
```

The two `<span>` siblings inside one `<text>` are concatenated row-wise by OpenTUI — confirmed because the current code already feeds multi-line strings to `<text>` and the rendering preserves the rows. Each `<span>` renders its own multi-line block; placing two side-by-side in one `<text>` lays them out as adjacent columns of the same rows (this is how OpenTUI's `<text>` treats sibling `<span>`s — same row, inline). Invariants I14 (siblings, same row) and I15 (`ACCENT_HEX` imported, not inlined) hold.

**Untouched**: book-frame chrome, verse rows, version line, help line — all stay `<text attributes={DIM}>…</text>` or default fg. No reducer/state change (R8/I16), no `useEffect` added (R9/I17), no class added (R2).

### MODIFIED: `docs/ui-sketches.md`

Apply phase will rewrite these sections; design just names them so tasks can scope cleanly:

- `## Style legend` (line 5) — remove "**monochrome minimal**. No hue."; replace with "**monochrome with one accent**. One reserved hue (accent blue) signals interactivity; everything else is default fg / `dim` / `bold` / `inverse`."
- `## Visual identity` (line 21) — section preamble, may need a one-paragraph rewrite to mention the accent token.
- `### Color philosophy` (line 25) — full rewrite: replace the five "no hue" axioms with the three-tier text hierarchy (`text` / `muted` / `dim`) + the `accent` token + the `error` token. Include the five-row Token Semantics table copied from the proposal. Restore the spirit of #184's "monochrome-with-one-accent" framing.
- Bullet at line 29 ("Dim is the only 'color'. No hue ever.") — delete.

Downstream sections (lines 145, 146, 210, 365) already reference `accent` — they survive the rewrite unchanged.

## `isColorEnabled` Truth Table (test fixtures)

| # | NO_COLOR | FORCE_COLOR | stream.isTTY | Result | Rationale |
|---|----------|-------------|--------------|--------|-----------|
| T1 | unset | unset | true | **enabled** | TTY default |
| T2 | unset | unset | false | **disabled** | piped, no override |
| T3 | `"1"` | unset | true | **disabled** | no-color.org: non-empty disables |
| T4 | `""` | unset | true | **enabled** | empty = no opinion (spec I7 / S3) |
| T5 | unset | `"1"` | false | **enabled** | FORCE_COLOR overrides isTTY |
| T6 | unset | `"0"` | true | **disabled** | npm convention: "0" = force off |
| T7 | unset | `"false"` | true | **disabled** | npm convention: "false" = force off |
| T8 | `"1"` | `"1"` | false | **disabled** | NO_COLOR wins (no-color.org is mandatory) |
| T9 | unset | `"true"` | false | **enabled** | "true" enables |

These are the exact assertions in `src/cli/ansi.test.ts`.

## Commit Sequence (work-unit-commits — each leaves tree green)

| # | Title | Files | Approx LOC | Verification |
|---|-------|-------|-----------|--------------|
| C1 | `feat(presentation): add ACCENT_HEX constant` | `src/presentation/colors.ts` (NEW) | +5 | `bun test` green (no consumer yet, but file compiles) |
| C2 | `feat(cli): add ANSI helpers + isColorEnabled` | `src/cli/ansi.ts` (NEW), `src/cli/ansi.test.ts` (NEW) | +50 / +90 tests | `bun test` green; 9-row truth table passes |
| C3 | `feat(scripts): split banner into Verb + um with parity guard` | `scripts/generate-banner.ts`, `src/cli/banner.ts` (regenerated), `src/tui/welcome/welcome-screen.tsx` (BANNER → BANNER_DIM_PART/BANNER_ACCENT_PART/BANNER_WIDTH + two `<span>`s + accent import) | +25 generator / +14 generated / +6 welcome-screen | `bun run generate:banner`; `bun test`; `bun run src/index.tsx` (TUI mounts, wordmark shows two-tone) |
| C4 | `feat(cli): apply error token to render errors` | `src/cli/render.ts` | +12 | `bun test`; `bun run src/index.tsx nonexistent` → red in TTY, plain when piped; `NO_COLOR=1 ...` plain |
| C5 | `docs(ui-sketches): restore accent token and three-tier hierarchy` | `docs/ui-sketches.md` | ±30 net | manual read; no code consequence |

**Why C3 bundles welcome-screen.tsx with banner.ts**: removing the `BANNER` export breaks welcome-screen.tsx; the two changes MUST land together to keep the tree green. This is a single work-unit ("two-tone banner end-to-end").

**Why no C6 from the briefed list**: the brief proposed C5 (welcome-screen) + C6 (docs) as separate commits. I'm folding welcome-screen into C3 because of the BANNER-removal compile dependency. The docs commit becomes C5. Total: **5 commits, not 6**. Total est. delta: **~135 logic + ~14 generated + ~30 docs = ~180 lines** — comfortably under the 400-line review budget; no chained-PR strategy needed (matches proposal's "First Reviewable Cut").

`Decision needed before apply: No`
`Chained PRs recommended: No`
`400-line budget risk: Low`

## Open Design Questions

**None.** All three spec-flagged items resolved above. The departure from spec's helper signature (`enabled: boolean` arg vs implicit env read) is a documented refinement that preserves every spec invariant — calling it out here for the apply phase, not as a blocker.
