# Spec: visual-identity-v1

## TL;DR
Introduce a semantic token set + ANSI helpers (new), apply them to CLI passage/error rendering (modified), and render the TUI welcome wordmark in two-tone (modified). Zero new runtime deps. Color output gates on TTY/NO_COLOR/FORCE_COLOR; plain-text output is byte-for-byte identical when color is disabled.

---

## Capability 1 — `visual-tokens` (NEW)

### Purpose
Provide verbum's presentation tier with a single source of truth for color values and ANSI rendering primitives, shared across CLI and TUI surfaces. Keep domain/application/api layers untouched.

### Sub-module: `src/presentation/colors.ts`

**Contract**
- Default-exports nothing. Named exports only.
- `ACCENT_HEX: string` — `"#5BA0F2"` (opencode blue, locked D1/D3).
- No imports. No logic. No types beyond `string`. A pure constant file.
- Adding a future constant is a one-line additive change to this file only.

**Invariants**
- I1: `ACCENT_HEX` value is exactly `"#5BA0F2"`. Any drift is a breaking change to the locked direction.
- I2: The file has zero `import` statements.
- I3: No Zod, no domain types, no runtime logic — R4 compliance.

### Sub-module: `src/cli/ansi.ts`

**Contract**

```ts
// Public surface
export const RESET: string;                          // "\x1b[0m"
export function accent(s: string): string;           // truecolor fg wrap or passthrough
export function dim(s: string): string;              // ANSI attr 2 wrap or passthrough
export function muted(s: string): string;            // passthrough (default fg, no escape — identity fn today)
export function error(s: string): string;            // ANSI 31 wrap or passthrough
export function isColorEnabled(stream: NodeJS.WriteStream): boolean;
```

**Escape formats (when color enabled)**

| Helper | Wrap format |
|--------|-------------|
| `accent(s)` | `\x1b[38;2;91;160;242m{s}\x1b[0m` |
| `dim(s)` | `\x1b[2m{s}\x1b[22m` |
| `muted(s)` | `{s}` (identity — terminal default fg, no escape) |
| `error(s)` | `\x1b[31m{s}\x1b[39m` |

Note: `accent` uses `\x1b[0m` (full reset) as closer; `dim` uses `\x1b[22m` (reset bold/dim only). Both are correct per the table in the proposal's Token Semantics section.

**`isColorEnabled(stream)` semantics (D8)**

Color is ENABLED iff ALL of the following are true:
1. `stream.isTTY === true`
2. `process.env.NO_COLOR` is either `undefined` or `""` (empty string)
3. OR: `process.env.FORCE_COLOR` is set to a non-empty string (overrides conditions 1–2)

Formally:
```
isColorEnabled(stream) =
  (FORCE_COLOR non-empty) || (stream.isTTY === true && NO_COLOR not non-empty)
```

- `NO_COLOR` with any non-empty value (e.g. `"1"`, `"true"`, `"yes"`) disables color.
- `NO_COLOR=""` (empty string) is treated as unset — color proceeds per `isTTY`.
- `FORCE_COLOR` set to any non-empty string forces color on, regardless of `isTTY` and `NO_COLOR`.
- Streams are evaluated independently. Callers pass the specific stream they are writing to.

**Invariants**
- I4: When `isColorEnabled(stream) === false`, every helper is an identity function (`accent(s) === s`, etc.).
- I5: `muted` is always an identity function regardless of color state (token exists for semantic tagging, not visible output change).
- I6: No helper reads `process.env` directly — only `isColorEnabled` does. Helpers receive color-enabled state implicitly by checking `isColorEnabled` at call time, or by the caller passing the result. (Implementation detail — what matters for the spec: the single point of env-var reading is `isColorEnabled`.)
- I7: The file imports from `src/presentation/colors.ts` for `ACCENT_HEX` and from nothing else outside Node built-ins.

### Sub-module: `src/cli/banner.ts`

**Contract**
- Exports `BANNER_DIM_PART: string` — the "Verb" figlet block as a single multi-line string (lines joined by `\n`).
- Exports `BANNER_ACCENT_PART: string` — the "um" figlet block as a single multi-line string.
- Exports `BANNER_WIDTH: number` — the character width of one banner column (used by the TUI layout).
- The legacy monolithic `BANNER` export is REMOVED (breaking change, intentional — welcome-screen.tsx is the only consumer).

**Parity invariant (I8):** `BANNER_DIM_PART.split("\n").length === BANNER_ACCENT_PART.split("\n").length`. Every corresponding line at index `i` in `BANNER_DIM_PART` and `BANNER_ACCENT_PART` has the same character width. This is the **banner parity invariant**.

### Sub-module: `scripts/generate-banner.ts`

**Contract**
- Runs `figlet` twice: once on `"Verb"`, once on `"um"`, using ANSI Shadow font.
- Writes the result as the two string exports in `src/cli/banner.ts`.
- Validates parity before writing: if line counts differ OR any line-pair widths differ, the script exits non-zero and prints a descriptive error. It does NOT write the output file on parity failure.

**Invariant (I9):** The generator is the authoritative source of `banner.ts`. Hand-editing `banner.ts` directly is out of spec — it will be overwritten by the next generator run.

---

## Capability 2 — `cli-passage-render` (MODIFIED)

### Purpose
Gate ANSI token wraps on stream color state so that CLI output is richly colored in a TTY and byte-for-byte plain text when piped or when `NO_COLOR` is active.

### File: `src/cli/render.ts`

**Contract changes**

```ts
// Signatures unchanged — callers are unaffected
export function renderPassage(passage: Passage): string;
export function renderParseError(err: ParseError): string;
export function renderRepoError(err: RepoError): string;
```

**Behavior deltas**

| Function | Color disabled | Color enabled |
|----------|---------------|---------------|
| `renderPassage` | identical to pre-change output | verse text emitted with `text` token (identity fn — no escape added; infrastructure present for future reference-label addition) |
| `renderParseError` | identical to pre-change output | entire output string wrapped in `error(...)` |
| `renderRepoError` | identical to pre-change output | entire output string wrapped in `error(...)` |

- `renderPassage` keys off `isColorEnabled(process.stdout)`.
- `renderParseError` and `renderRepoError` key off `isColorEnabled(process.stderr)`.
- The two streams are checked independently (D8).

**Invariants**
- I10: When `isColorEnabled(process.stdout) === false`, `renderPassage` output is byte-for-byte identical to the pre-change version.
- I11: When `isColorEnabled(process.stderr) === false`, both error renderers produce byte-for-byte identical output to the pre-change version.
- I12: `renderPassage` never emits a visible ANSI escape for verse text in v1 (because `text` token = identity). The function structure is updated but the emitted bytes are unchanged when color is enabled.
- I13: No Zod, no domain imports added — R4 compliance maintained. Render functions remain pure string transformations.

---

## Capability 3 — `tui-welcome-screen` (MODIFIED)

### Purpose
Render the verbum wordmark in two adjacent text spans — "Verb" dimmed, "um" in accent blue — matching the locked two-tone direction (D3).

### File: `src/tui/welcome/welcome-screen.tsx`

**Contract changes**

The wordmark section currently renders from a monolithic `BANNER` export. After this change:

- It consumes `BANNER_DIM_PART` and `BANNER_ACCENT_PART` from `src/cli/banner.ts`.
- It consumes `ACCENT_HEX` from `src/presentation/colors.ts`.
- The wordmark renders as two adjacent `<span>` elements placed on the same visual line:
  - `<span attributes={[DIM]}>{BANNER_DIM_PART}</span>` — "Verb" half
  - `<span fg={ACCENT_HEX}>{BANNER_ACCENT_PART}</span>` — "um" half
- Book frame chrome: unchanged from c2d4c36 (already uses `dim` attribute).
- Verse text: unchanged from c2d4c36 (already uses terminal default fg).
- TUI reducer, state shape, and all non-wordmark elements: zero touch (D2).

**Invariants**
- I14: The two `<span>` elements are siblings in the same container row — no block-level element between them.
- I15: `ACCENT_HEX` is not hardcoded in JSX — it is imported from `src/presentation/colors.ts`.
- I16: `useReducer` business state is not modified (R8 compliance).
- I17: No `useEffect` is added (R9 compliance).

**CLI banner standalone status**
The banner (wordmark) is TUI-only in v1. There is no `verbum --version` or `verbum help` that prints the figlet banner to stdout. If a future change adds such a command, it must define its own color-gated banner render using the `BANNER_DIM_PART` / `BANNER_ACCENT_PART` exports and the `dim`/`accent` ANSI helpers. This spec does NOT cover that path.

---

## Acceptance Scenarios

### Token + ANSI behavior

**S1 — Color enabled in TTY**
WHEN `stream.isTTY === true` AND `process.env.NO_COLOR` is undefined AND `process.env.FORCE_COLOR` is undefined,
THEN `accent("hello")` returns `"\x1b[38;2;91;160;242mhello\x1b[0m"`.

**S2 — NO_COLOR non-empty disables color**
WHEN `process.env.NO_COLOR = "1"` (any non-empty string) AND `stream.isTTY === true`,
THEN `accent("hello") === "hello"` (no escapes).

**S3 — NO_COLOR empty string does NOT disable color**
WHEN `process.env.NO_COLOR = ""` (set but empty) AND `stream.isTTY === true`,
THEN `isColorEnabled(stream) === true` and `accent("hello")` returns the wrapped string.
Rationale: https://no-color.org specifies "set to a non-empty string". Empty = unset.

**S4 — FORCE_COLOR overrides isTTY**
WHEN `process.env.FORCE_COLOR = "1"` AND `stream.isTTY === false`,
THEN `isColorEnabled(stream) === true` and `accent("hello")` returns the wrapped string.

**S5 — Piped output produces zero escapes**
WHEN `stream.isTTY === false` AND `process.env.FORCE_COLOR` is unset,
THEN `isColorEnabled(stream) === false` and `accent("hello") === "hello"`.

**S6 — Stream independence**
WHEN `process.stdout.isTTY === false` AND `process.stderr.isTTY === true`,
THEN `isColorEnabled(process.stdout) === false` AND `isColorEnabled(process.stderr) === true`.
Consequence: error output wraps; passage output does not.

**S7 — muted is always identity**
WHEN color is enabled OR disabled,
THEN `muted("x") === "x"` (no escapes ever).

### Passage / error rendering

**S8 — Passage render, colors disabled**
WHEN `isColorEnabled(process.stdout) === false`,
THEN `renderPassage(passage)` output is byte-for-byte identical to the pre-change output for the same passage.

**S9 — Passage render, colors enabled**
WHEN `isColorEnabled(process.stdout) === true`,
THEN `renderPassage(passage)` returns the verse text with no visible ANSI escapes (because `text` token = identity fn in v1). Output is byte-for-byte identical to the pre-change output.

**S10 — Error render, colors enabled**
WHEN `isColorEnabled(process.stderr) === true`,
THEN `renderParseError(err)` and `renderRepoError(err)` outputs are wrapped: `"\x1b[31m{plain-text}\x1b[39m"`.

**S11 — Error render, colors disabled**
WHEN `isColorEnabled(process.stderr) === false`,
THEN both error renderers produce byte-for-byte identical output to pre-change behavior.

**S12 — `verbum nonexistent` piped to file**
WHEN the CLI command `verbum nonexistent > /tmp/out.txt` is run,
THEN `cat /tmp/out.txt` contains zero ANSI escape sequences.

**S13 — FORCE_COLOR overrides pipe for errors**
WHEN `FORCE_COLOR=1 verbum nonexistent | cat` is run,
THEN the output contains ANSI red escape sequences around the error text.

### Banner

**S14 — Banner parity invariant**
WHEN `scripts/generate-banner.ts` runs,
THEN `BANNER_DIM_PART.split("\n").length === BANNER_ACCENT_PART.split("\n").length`
AND for every index `i`, `BANNER_DIM_PART.split("\n")[i].length === BANNER_ACCENT_PART.split("\n")[i].length`.
IF this is violated, the script exits non-zero without writing `banner.ts`.

**S15 — Wordmark two-tone in TUI**
WHEN the welcome screen mounts,
THEN the wordmark region contains two adjacent `<span>` children in the same row:
  - first child has `attributes` containing DIM; its text content derives from `BANNER_DIM_PART`
  - second child has `fg="#5BA0F2"`; its text content derives from `BANNER_ACCENT_PART`

**S16 — No runtime dependencies added**
WHEN `package.json` is inspected after the change,
THEN `dependencies` contains no new entries compared to pre-change.

**S17 — Existing tests still pass**
WHEN the full test suite runs,
THEN all tests that passed before the change still pass.

**S18 — New unit tests cover ANSI helpers**
WHEN tests for `src/cli/ansi.ts` are run,
THEN the following permutations are covered:
  - TTY=true, NO_COLOR unset → color enabled
  - TTY=true, NO_COLOR="1" → color disabled
  - TTY=true, NO_COLOR="" → color enabled
  - TTY=false, FORCE_COLOR unset → color disabled
  - TTY=false, FORCE_COLOR="1" → color enabled
  - Each helper: output with color enabled and disabled

---

## Out of Scope

Mirrors proposal Non-goals exactly:
- Three-tier hierarchy applied inside `welcome-screen.tsx` (no actionable affordances exist yet — D2)
- Hollow/halftone figlet font for the dim half (D4)
- Accent applied to any surface not yet built (status line, focus indicators, cursor, spinner)
- 256-color / 16-color fallback escapes (D7)
- Color-customization config or palette presets
- ANSI wrapping in `welcome-content.ts` (string constants — wrong layer)
- Domain / application / api / TUI reducer changes — zero touch
- CLI banner printed outside TUI (no `--version`/`help` banner in v1)

---

## Spec-Level Risks

| Risk | Spec assumption made |
|------|---------------------|
| NO_COLOR behavior for empty-string value | Spec follows https://no-color.org strictly: only non-empty values disable color. If a future terminal ecosystem convention differs, this is the tie-breaker. |
| FORCE_COLOR non-empty definition | Spec treats any non-empty string as "force on". Does not attempt to parse `"0"` as "force off" (that would be a separate convention — npm's `FORCE_COLOR=0` means "disable". This spec does not implement that nuance; treat `FORCE_COLOR` as a boolean on/off by presence/absence of non-empty value.) |
| `dim` escape closer | Using `\x1b[22m` (reset bold/dim only) vs `\x1b[0m` (full reset). Spec pins `dim` closer to `\x1b[22m` to avoid resetting other attributes. If nesting of attributes is needed in a future helper, this is the right choice. |
| OpenTUI `attributes` API for DIM | Spec assumes OpenTUI accepts `attributes={[DIM]}` where `DIM` is a known constant. If the actual API differs, design phase must reconcile but the spec behavior (dim attribute on "Verb" span) is non-negotiable. |
| Banner string vs string[] | Spec requires `BANNER_DIM_PART` and `BANNER_ACCENT_PART` to be `string` (multi-line, `\n`-joined). If OpenTUI requires `string[]` for multi-line spans, the design phase may adjust the export type; the parity invariant still applies. |
