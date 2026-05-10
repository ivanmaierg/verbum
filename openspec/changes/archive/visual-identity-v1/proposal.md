# Proposal: visual-identity-v1

## TL;DR
Establish verbum's visual identity by introducing a tiny semantic token system (one accent hex + ANSI dim/reset), TTY/NO_COLOR/FORCE_COLOR detection, and applying tokens at three surfaces: CLI verse render, CLI error render, and the TUI welcome wordmark. Reconcile `docs/ui-sketches.md` with the locked accent direction in the same change. Zero new runtime deps, zero domain/application/api churn.

## Intent
Today verbum is text-only — zero color anywhere — and `docs/ui-sketches.md` (post-c2d4c36) explicitly forbids hue. The locked direction (engram #184 + #200) supersedes that rule: an opencode-style blue accent (#5BA0F2) is reserved for actionable affordances, with a three-tier text hierarchy and a two-tone wordmark. v1 ships the TOKENS and applies them only where there is an existing visible surface. No interactive affordances are added in this change.

## Scope

### In Scope
- `src/presentation/colors.ts` (NEW) — pure hex string constants, zero imports.
- `src/cli/ansi.ts` (NEW) — `accent(s)`, `dim(s)`, `RESET`, `isColorEnabled(stream)` with TTY + NO_COLOR + FORCE_COLOR semantics.
- `src/cli/render.ts` (MODIFIED) — wrap `renderPassage` and the two error renderers in tokens, gated by stdout/stderr `isTTY`.
- `scripts/generate-banner.ts` (MODIFIED) — emit two figlet runs ("Verb" + "um") and zip lines.
- `src/cli/banner.ts` (MODIFIED) — export `BANNER_DIM_PART` + `BANNER_ACCENT_PART` arrays plus `BANNER_WIDTH`.
- `src/tui/welcome/welcome-screen.tsx` (MODIFIED) — render the wordmark as two adjacent `<span>`s consuming `BANNER_DIM_PART` (DIM attribute) and `BANNER_ACCENT_PART` (`fg={ACCENT_HEX}`).
- `docs/ui-sketches.md` (MODIFIED) — remove "no hue, ever" rule, restore `accent` token + three-tier table.

### Out of Scope
- Three-tier hierarchy applied inside `welcome-screen.tsx` (no actionable affordances exist there yet).
- Hollow/halftone figlet font for the dim half (aspirational).
- Accent applied to any surface that doesn't exist yet (status line, focus indicators, cursor, loading spinner — those land with their feature).
- 256-color / 16-color fallback escapes.
- Color-customization config or palette presets.
- Domain / application / api / TUI reducer changes — zero touch.

## Capabilities

### New Capabilities
- `presentation-tokens`: shared semantic color constants (hex strings) consumed by CLI ANSI helpers and TUI OpenTUI components.
- `cli-color-output`: ANSI truecolor + dim attribute helpers and TTY/NO_COLOR/FORCE_COLOR detection for CLI surfaces.

### Modified Capabilities
- `cli-render`: passage and error rendering now emit ANSI escapes when color is enabled, plain text otherwise.
- `tui-welcome-screen`: wordmark rendered as two-tone (Verb dim / um accent); chrome and verse text behavior unchanged.
- `cli-banner`: banner module exports two pre-split line arrays instead of a single monolithic string.

## Approach
Option B from exploration #203. A pure-constant `src/presentation/` directory holds hex codes; no logic, no deps, no layer boundary crossed (both CLI and TUI are presentation-tier). CLI gets its own hand-rolled `ansi.ts` (3 helpers + 1 detector ~25 lines); TUI consumes the same hex via OpenTUI's `<span fg={hex}>`. The wordmark split is done at generation time (two figlet runs), not parse time — column-counting block glyphs is fragile. Truecolor only — modern terminals approximate gracefully and Bun users skew modern.

## Decisions

**D1 — Direction confirmation (LOCKED).** The locked accent direction (engram #184 + #200) supersedes c2d4c36's "no hue, ever" rule. Most recent decision wins: c2d4c36 landed before the user's four-option side-by-side that picked opencode blue with "pure monochrome" explicitly available as a rejected option. `docs/ui-sketches.md` is updated in this change to restore the accent token and three-tier table. No code rework on welcome-screen.tsx — the conflict was a docs conflict; the screen has no actionable affordances where accent would appear today.

**D2 — Three-tier scope in welcome-screen.tsx (NOT in scope for v1).** Current 2-tier (DIM chrome + default-fg verse) is correct under the locked direction. Three-tier (a `muted` mid-tier between bright fg and DIM) only matters when there is content that is "secondary" to "primary" — reference labels in chrome, model/source labels, status payloads. The current welcome screen has none of these as interactive content. v1 ships the tokens in the theme module so future surfaces can consume them, but does not apply mid-tier where there's no semantic role for it. Adding it now would be decoration, not signal.

**D3 — Wordmark two-tone split point (4-2, "Verb" dim + "um" accent).** Smaller accent (33%) acts as a punch-color rather than a dominant element — opencode's 50% split is a stylistic choice, not a rule. "bum" as the bright half is a non-starter (English false-friend). Implementation: `scripts/generate-banner.ts` runs figlet twice — once on "Verb", once on "um" — and emits two parallel string arrays. The consumer (welcome-screen.tsx today, future `--version` later) concatenates the corresponding lines at render time with adjacent `<span>`s.

**D4 — Hollow figlet for dim half (OUT of scope).** Aspirational. OpenTUI has no halftone primitive; figlet's "Hollow" font produces outlines, not halftone, which is a different aesthetic. Two-tone via solid figlet + DIM attribute on the left half is sufficient signal for v1. Revisit if a later iteration wants more texture differentiation.

**D5 — Token architecture (Option B).** `src/presentation/colors.ts` (NEW) holds pure hex string constants — no imports, no logic. `src/cli/ansi.ts` wraps tokens with ANSI escapes + stream detection. TUI consumes the hex constants directly via `<span fg={hex}>` (OpenTUI accepts hex strings — confirmed in TextNodeOptions). Why `src/presentation/`: verbum is hexagonal but the presentation tier already exists conceptually as `src/cli/` + `src/tui/`. A `src/presentation/` directory holds shared visual constants without crossing domain/application/api boundaries — it sits at the same layer as cli/tui and is consumed by both.

**D6 — CLI ANSI implementation (hand-rolled, no new deps).** Continues the no-deps-by-default posture from `verbum-vod`. The token surface is exactly 3 helpers (`accent`, `dim`, `RESET`) + 1 detector. picocolors / chalk add a lockfile entry for ~15 lines of code we'd write anyway. Tradeoff: we maintain the truecolor escape sequence ourselves and own the NO_COLOR semantics — both are tiny, both are well-specified.

**D7 — Truecolor only, no fallback.** Emit `\x1b[38;2;91;160;242m` for #5BA0F2. Modern terminals approximate gracefully; Bun users skew modern (iTerm2, kitty, alacritty, GNOME Terminal 3.38+, macOS Terminal 2020+ all support truecolor). 256-color fallback adds capability detection logic for marginal user impact. Revisit if a real complaint surfaces.

**D8 — TTY/NO_COLOR semantics.** Color is enabled when ALL true: stream's `isTTY === true` AND (`NO_COLOR` env unset OR empty). `FORCE_COLOR` (when set to non-empty) overrides both. Implementation: `isColorEnabled(stream: NodeJS.WriteStream)` exported from `src/cli/ansi.ts`. The error renderer keys off `process.stderr.isTTY`; the passage renderer keys off `process.stdout.isTTY`. They are checked independently because piping stdout to a file does not silence stderr.

## Token Semantics (LOCKED)

| Token | Semantic role | Value | CLI render | TUI render |
|-------|---------------|-------|------------|------------|
| `text` | Primary content (verse text, future active state) | terminal default fg | no escape | OpenTUI default |
| `muted` | Secondary content (future reference labels, model/source labels) | default fg without DIM | no escape | OpenTUI default (no attribute) |
| `dim` | Tertiary content (chrome, keybind action descriptions, meta) | ANSI attribute 2 | `\x1b[2m…\x1b[22m` | `<span attributes={DIM}>` |
| `accent` | Actionable affordances (cursor, current mode, focused frame, keybind letters, future spinner, wordmark "um") | `#5BA0F2` truecolor | `\x1b[38;2;91;160;242m…\x1b[39m` | `<span fg="#5BA0F2">` |
| `error` | Error message foreground | ANSI 31 (red) | `\x1b[31m…\x1b[39m` | n/a (no TUI errors yet) |

**Taste calls justified.** `muted` = "default fg without DIM" rather than a separate hex (#888 etc.) keeps the palette to ONE hue (accent only), closer to the locked "monochrome with one accent" philosophy. A separate muted hex would push the design toward "two-color system" which fights the locked direction. **`error` = standard ANSI red, not accent blue.** Errors deserve a distinct semantic; accent is "look here, this is interactive", red is "this is wrong". Universally legible across terminal palettes. The radical alternative (accent for errors) was considered and rejected: it conflates two different signals.

## Surface Mapping (LOCKED)

| Surface | File | Tokens consumed | Notes |
|---------|------|-----------------|-------|
| `renderPassage(passage)` | `src/cli/render.ts` | `text` only | Confirmed via inspection: today the function emits ONLY verse text (`v.text` joined). No reference label exists. v1 keeps it that way — `text` is "default fg, no escape", so the only visible effect for piped output is unchanged. The infrastructure (TTY guard, ANSI helpers) lands here so that adding a reference label in a later change is a one-liner. |
| `renderParseError(err)` | `src/cli/render.ts` | `error` for the whole line | Whole line is one token. The `Error:` prefix does NOT get a stronger treatment in v1 — keeps the renderer simple and matches conventional CLI ergonomics. Splitting prefix from body invites taste-creep without functional gain. |
| `renderRepoError(err)` | `src/cli/render.ts` | `error` for the whole line | Same as above. |
| TUI welcome wordmark | `src/tui/welcome/welcome-screen.tsx` | `dim` for "Verb", `accent` for "um" | Two adjacent `<span>` elements consuming `BANNER_DIM_PART` (with `attributes={DIM}`) and `BANNER_ACCENT_PART` (with `fg={ACCENT_HEX}`). |
| TUI welcome book frame | `src/tui/welcome/welcome-screen.tsx` | `dim` (already implemented) | No changes. |
| TUI welcome verse text | `src/tui/welcome/welcome-screen.tsx` | `text` (already implemented as default fg) | No changes. |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/presentation/colors.ts` | NEW | Hex string constants — `ACCENT_HEX = "#5BA0F2"` and any future shared values. |
| `src/cli/ansi.ts` | NEW | `accent`, `dim`, `RESET`, `isColorEnabled`. ~25 lines. |
| `src/cli/render.ts` | MODIFIED | Wrap output strings; gate on stream isTTY. |
| `scripts/generate-banner.ts` | MODIFIED | Two figlet runs; emit two arrays. |
| `src/cli/banner.ts` | MODIFIED | Replace `BANNER` string with `BANNER_DIM_PART`, `BANNER_ACCENT_PART`, `BANNER_WIDTH`. |
| `src/tui/welcome/welcome-screen.tsx` | MODIFIED | Two-tone wordmark render; remove dependency on monolithic `BANNER`. |
| `docs/ui-sketches.md` | MODIFIED | Drop "no hue, ever"; restore accent token + three-tier table. |

Domain / application / api / TUI reducer / verse-content / vod / run / tui-driver: unchanged.

## First Reviewable Cut
Single PR — full scope ships together. Estimated changed lines:

- Logic: ~100 lines (colors.ts ~5, ansi.ts ~25, render.ts ~30 deltas, generate-banner.ts ~15 deltas, welcome-screen.tsx ~20 deltas)
- Data/generated: banner.ts is regenerated (~12 lines, generated)
- Docs: docs/ui-sketches.md ~30 lines net

Total well under the 400-line review budget. No chained-PR strategy needed.

## Success Criteria
- [ ] `verbum john 3:16` in a TTY emits verse text (no escapes today, since there is no reference label yet — but the helpers are exercised in error paths).
- [ ] `verbum nonexistent` in a TTY emits the error in red; piped to a file produces zero ANSI escapes.
- [ ] `NO_COLOR=1 verbum nonexistent` in a TTY produces zero ANSI escapes.
- [ ] `FORCE_COLOR=1 verbum nonexistent | cat` produces ANSI escapes despite the pipe.
- [ ] `verbum vod` displays the same way (vod consumes render.ts).
- [ ] The TUI welcome screen wordmark renders "Verb" dim and "um" accent blue (#5BA0F2).
- [ ] `docs/ui-sketches.md` no longer contains the "no hue, ever" rule and contains an `accent` token entry plus a three-tier hierarchy table.
- [ ] No new runtime dependencies in `package.json`.
- [ ] All existing tests pass; new tests cover ANSI helpers + isColorEnabled across all stream/env permutations.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| c2d4c36 doc reconciliation surfaces a third opinion | Low | Resolution is documented in engram #204; ui-sketches.md update ships in this change. |
| Terminal compatibility (older terminals approximate truecolor) | Low | Truecolor + graceful approximation is the de-facto standard for modern CLI tools. Revisit if real complaints. |
| NO_COLOR semantics edge cases (e.g. `NO_COLOR=""` vs unset) | Low | Per https://no-color.org: any non-empty value disables color. Empty/unset enables. Single function captures this; tested across permutations. |
| Wordmark column-zip misalignment if "Verb" and "um" figlet outputs have different line counts | Low | ANSI Shadow font is fixed-height (6 rows + trailing space). Generator validates line-count parity at build time and fails loudly if it ever drifts. |
| OpenTUI hex string `fg` prop incompatibility | Low | Confirmed in TextNodeOptions — `fg?: string \| RGBA`. |

## Rollback Plan
Single revert. The change is additive across NEW files (colors.ts, ansi.ts) and minimal-surface deltas in three existing files. Reverting the PR restores the post-c2d4c36 monochrome behavior. No data migration, no env-var dependency, no user-visible state changes.

## Dependencies
None. No new runtime deps. `figlet` is already a devDependency.

## Non-Goals (explicit)
- Three-tier hierarchy applied inside `welcome-screen.tsx` (no surface for it yet).
- Hollow/halftone figlet font.
- Accent on any TUI affordance that doesn't exist yet (status line, focus, cursor, spinner).
- Color customization config / palette presets / theme switching.
- 256-color / 16-color fallback escapes.
- ANSI on `welcome-content.ts` (string constants — wrong layer).
