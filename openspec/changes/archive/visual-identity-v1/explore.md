## Exploration: visual-identity-v1

### TL;DR — Riskiest Unknown

**c2d4c36 is a DIRECT CONFLICT with the locked direction.** The commit landed on main and explicitly REMOVED accent-color references from docs/ui-sketches.md to enforce a pure monochrome-only philosophy. It describes "no hue, ever" as its governing rule. The locked direction (engram #184 + #200) requires a blue accent (#5BA0F2) for actionable affordances, a three-tier text hierarchy (bright white / mid grey / dim grey), and a two-tone wordmark. These two directions are irreconcilable without choosing one. This must be resolved before the proposal phase can proceed.

Secondary risk: `docs/ui-sketches.md` was rewritten by c2d4c36 as the authoritative color spec, and it now describes a token system (primary/muted/emphasis/selection/marker) that maps to OpenTUI TEXT ATTRIBUTES only — no hue at all. The welcome-screen.tsx implementation is aligned with THAT document, not with the locked direction.

---

### Current State (post-c2d4c36 audit)

#### What c2d4c36 changed

The commit touched three surfaces:
1. **`docs/ui-sketches.md`** — Full rewrite of the Style legend (now 5 tokens: primary/muted/emphasis/selection/marker, all attribute-based), added "Color philosophy" subsection with "no hue, ever" as the absolute rule, synced Welcome/--version mockups to current implementation, and **explicitly dropped accent-color references from the Typography table**.
2. **`src/tui/welcome/welcome-screen.tsx`** — Decomposed monolithic BOOK_FRAME string into per-row `<text>` elements + `VerseRow` helper using `<span attributes={DIM}>` for chrome, keeping verse text at default fg.

#### Token system in c2d4c36

No separate theme module was created. Tokens are expressed inline:
- `DIM = TextAttributes.DIM` — a single const in welcome-screen.tsx (line 28)
- All other "tokens" are implied (default fg = primary, bold = emphasis)
- No `src/presentation/theme.ts`, no `src/cli/theme.ts`, no shared module
- TTY detection is NOT done for CLI colors (there are no CLI colors to toggle)
- NO_COLOR is not implemented (no colors in CLI currently)
- No accent, no accent detection, no truecolor emitting

#### Current state per surface

| Surface | File | State after c2d4c36 |
|---------|------|---------------------|
| TUI welcome screen | `src/tui/welcome/welcome-screen.tsx` | IMPLEMENTED — DIM for chrome, default fg for verse text. No accent. |
| CLI verse rendering | `src/cli/render.ts` | Plain text strings. No ANSI. No TTY detection. |
| CLI error rendering | `src/cli/render.ts` | Plain text strings. No ANSI. No TTY detection. |
| CLI welcome content | `src/cli/welcome-content.ts` | String constants only. No color concern here. |
| ANSI wordmark | `src/cli/banner.ts` | ANSI Shadow figlet, monochrome. No two-tone split. |
| Banner generator | `scripts/generate-banner.ts` | Runs figlet once, outputs single string. No split. |
| TTY/NO_COLOR detection | nowhere | Does not exist. tui-driver.tsx checks isTTY for TUI mode only. |
| Theme module | nowhere | Does not exist. No shared token layer. |
| Docs token spec | `docs/ui-sketches.md` | Monochrome-only, accent explicitly removed. |

---

### The Conflict: c2d4c36 vs. Locked Direction

| Dimension | c2d4c36 (current main) | Locked Direction (#184 + #200) |
|-----------|------------------------|-------------------------------|
| Accent color | NONE — "no hue, ever" | #5BA0F2 blue for actionable affordances |
| Text hierarchy | 2-tier: default fg + DIM | 3-tier: bright white / mid grey / dim grey |
| CLI verse rendering | plain text | accent for reference header, muted for verse number, primary for text |
| Error messages | plain text | error color (emphasis) |
| Wordmark split | none (single ANSI art) | two-tone: dim half + bright half |
| NO_COLOR / TTY | not implemented | required |
| Token module | none | shared semantic token system |

The c2d4c36 commit message says: "drop accent-color references" — this was intentional. docs/ui-sketches.md as of c2d4c36 is the governing spec for the welcome screen's current implementation. Introducing accent would contradict that spec and the welcome-screen.tsx design philosophy.

**Resolution required**: the proposal phase MUST decide which direction wins. If the locked direction is final, docs/ui-sketches.md needs to be updated, the welcome screen needs to accept that chrome can be muted AND an accent token exists (they don't conflict if accent is reserved only for actionable affordances, which welcome-screen.tsx doesn't have). The conflict is smaller than it appears at first — the welcome screen as implemented has NO actionable affordances (no cursor, no mode label, no focused frame), so accent would not change welcome-screen.tsx at all, only future surfaces.

---

### What's Already Done (relative to locked direction)

- TUI welcome screen chrome/verse contrast: DONE (dim chrome, default fg verse). Aligns with locked direction's "verses breathe" rule.
- Basic DIM attribute usage in TUI: DONE.
- ANSI Shadow figlet wordmark: DONE. Two-tone split is missing.
- TTY guard for TUI mode (renderer): DONE in tui-driver.tsx.

### What's Missing (actual scope of visual-identity-v1)

1. **Docs alignment** — `docs/ui-sketches.md` needs to be reconciled with the locked direction. Currently describes no-accent; locked direction requires accent. Specifically: add `accent` token (maps to `fg="#5BA0F2"`), restore accent entries in Typography table.
2. **Shared theme module** — `src/cli/theme.ts` (or `src/presentation/theme.ts`) with semantic tokens and TTY/NO_COLOR detection. At minimum: `primary`, `secondary`, `tertiary`, `accent`, `noop` (used when no-color).
3. **CLI ANSI rendering** — `src/cli/render.ts` needs color: accent for reference header, muted for verse number, primary for text. Plus TTY/NO_COLOR guard.
4. **CLI error rendering** — same file, errors need emphasis/color treatment under TTY.
5. **Two-tone wordmark** — `scripts/generate-banner.ts` needs to split the figlet art into two portions and emit them with different color attributes. `src/cli/banner.ts` would need to export two constants (or a function) instead of one string.
6. **TTY/NO_COLOR/FORCE_COLOR detection helper** — new file, probably `src/cli/terminal.ts`.
7. **Three-tier text hierarchy in TUI** — welcome-screen.tsx currently uses DIM for chrome. If three-tier is applied, "secondary" elements (active labels, current mode) would get a specific bright treatment, "tertiary" gets DIM. For the current welcome screen with no interactive affordances, the visible change is minimal — this matters more for Reading view / status bar.

---

### Approaches Considered

#### Token System Architecture

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A: `src/presentation/theme.ts` shared by CLI + TUI | Single source of truth, easy to update palette | Creates a "presentation" layer not in current hexagonal structure; CLI imports from non-CLI layer | Low-Med |
| B: `src/cli/theme.ts` for CLI ANSI; TUI uses OpenTUI props directly | CLI owns its ANSI strings; TUI owns its OpenTUI attributes; clean layer separation | Two definitions of the same palette (small duplication) | Low |
| C: `src/cli/theme.ts` consumed by both | Weird direction (TUI imports from CLI layer) | Hexagonal violation | Low-Med |

**Recommendation: Option B.** The CLI emits raw ANSI escape strings; the TUI uses OpenTUI `fg` props (RGBA or hex string, per TextNodeOptions API). The color values (specifically the hex codes) can be co-located in a tiny shared constants file (`src/presentation/colors.ts`) that contains only string literals — no logic, no OpenTUI dependency, no ANSI dependency. Both `src/cli/theme.ts` and the TUI components import from it. This satisfies the hexagonal rule (colors.ts is pure constants) and avoids duplication of the palette.

#### CLI ANSI Implementation

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| Hand-rolled ANSI escapes | Zero deps, exact control, matches verbum's no-new-deps posture | Each token is a tiny wrap helper; truecolor escapes are verbose | Low |
| picocolors | Minimal (~1.5kb), NO_COLOR support built-in | Adds a dep | Low |
| chalk | Best-known, FORCE_COLOR etc. | Heavier, adds a dep | Low |

**Recommendation: hand-rolled.** Verbum has zero runtime ANSI deps currently. The required tokens are: accent (fg #5BA0F2 truecolor), dim (ANSI attribute 2), and reset. That's 3 helpers. A micro-module `src/cli/ansi.ts` with `accent(s: string): string`, `dim(s: string): string`, `reset()` is ~15 lines including TTY/NO_COLOR guard. This is the honest approach: the dependencies don't buy enough to justify the addition.

#### Truecolor vs. Fallback

| Approach | Risk | Notes |
|----------|------|-------|
| Truecolor only (`\x1b[38;2;R;G;Bm`) | Older terminals show approximate fg | Modern terminals (iTerm2, kitty, alacritty, GNOME Terminal 3.38+, macOS Terminal.app 2020+) all support truecolor. Bun users skew heavily modern. |
| 256-color fallback | Complexity: requires terminal capability detection | Nearest 256-color to #5BA0F2 is index 75 (`\x1b[38;5;75m`). Adds detection logic. |
| 16-color only | Safest, ugliest | `\x1b[34m` (blue) or `\x1b[94m` (bright blue) as accent approximation |

**Recommendation: truecolor, no fallback.** The `COLORTERM=truecolor` env var can be optionally checked. If absent but iTTY, still emit truecolor — the worst outcome is graceful approximation on an older terminal. This is consistent with how most modern terminal apps (lazygit, delta, starship, bat) behave.

#### Two-Tone Wordmark Split

The ANSI Shadow wordmark "Verbum" is rendered as 6 lines of block glyphs. Splitting at the character level requires generating TWO figlet strings separately and concatenating their lines column-by-column with different colors at print time.

Split options (per the 4-2 "Verb/um" recommendation in locked direction):
- **"Verb" (dim) + "um" (accent or bright)** — "Verb" dim conveys the Latin root of verbum; "um" bright is the suffix completing the word. This mirrors opencode's "open"/"code" aesthetic best.
- **"Ver" (dim) + "bum" (bright)** — 3-3 midpoint, but "bum" is an unfortunate English false-friend.
- **First letter "V" (accent) + "erbum" (dim)** — minimal accent, reversed emphasis (typical for monograms).

**Recommendation: "Verb" (dim) + "um" (accent color, not just bright white).** Using the accent color (#5BA0F2) for "um" introduces the accent into the wordmark as a design element — the same way opencode uses its blue half. This also means the wordmark becomes the first point of accent color introduction, which helps with visual hierarchy comprehension.

Implementation: `scripts/generate-banner.ts` generates two separate figlet outputs ("Verb" and "um"), then line-zip-concatenates them into `src/cli/banner.ts` as two exports: `BANNER_DIM_PART` and `BANNER_ACCENT_PART`. The consumer (welcome-screen.tsx, future --version) wraps them with appropriate color attributes at render time.

#### Halftone/Dotted Texture for Wordmark Dim Half

OpenTUI has no built-in halftone filter for text. Figlet has no halftone font equivalent. The opencode effect is likely a custom terminal gradient or a specific figlet font with hollow/dotted glyphs (e.g. "Hollow" or "Contessa" fonts). The bar is high:
- figlet's "Hollow" font produces outline-only glyphs — achievable with existing figlet devDep.
- True halftone (mix of ░▒▓█) would require custom rendering.

**Recommendation: treat as aspirational, not part of visual-identity-v1.** If "Hollow" font is aesthetically acceptable for the dim half (outline-only instead of halftone), it could be a nice-to-have. Mark for proposal-phase triage.

---

### Recommendation (Overall)

1. **Resolve the c2d4c36 conflict first** — update docs/ui-sketches.md to add the `accent` token and three-tier hierarchy. The welcome screen as-is does NOT need changes because it has no actionable affordances. The conflict is a docs conflict, not a code conflict at the welcome-screen level.
2. **New file: `src/presentation/colors.ts`** — pure string constants (hex values). No logic. No deps. Both CLI and TUI import from here.
3. **New file: `src/cli/ansi.ts`** — ANSI helpers wrapping the hex values with truecolor escapes + TTY/NO_COLOR guard. ~15–25 lines. Zero new deps.
4. **New file: `src/cli/terminal.ts`** (or inline in ansi.ts) — `isColorEnabled(): boolean` checking `isTTY`, `NO_COLOR`, `FORCE_COLOR`.
5. **Modify `src/cli/render.ts`** — consume `src/cli/ansi.ts` tokens for passage and error rendering.
6. **Modify `scripts/generate-banner.ts`** — split figlet output into two parts. **Modify `src/cli/banner.ts`** — export `BANNER_DIM_PART` and `BANNER_ACCENT_PART` string arrays.
7. **Modify `src/tui/welcome/welcome-screen.tsx`** — consume `src/presentation/colors.ts` for the two-tone banner render (using `<span fg={ACCENT_HEX}>` for "um" half).
8. **Modify `docs/ui-sketches.md`** — restore accent token, three-tier hierarchy, reconcile with locked direction.

---

### Open Questions for Proposal Phase

1. **Direction lock confirmation**: Is the locked direction from engram #184 (accent + three-tier) definitively overriding c2d4c36's "no hue, ever" philosophy? The user must confirm before the proposal can proceed.
2. **Three-tier hierarchy in welcome screen**: The current DIM-only implementation (dim chrome, default fg verse) is two-tier. Adding a third tier (secondary = specific brightness level) to the welcome screen would require distinguishing "reference labels" (secondary) from "drop shadow" (tertiary). Is this refinement in scope for v1?
3. **Wordmark split point final confirmation**: "Verb/um" (4-2) confirmed, or still open?
4. **Hollow figlet font for dim half**: In scope for v1 or backlog?
5. **Three-tier in TUI**: Does the locked direction intend to update existing welcome-screen.tsx to distinguish secondary/tertiary? Or is this only relevant for future Reading view / status bar?

---

### Files That Will Be Touched

| File | Status | Action |
|------|--------|--------|
| `src/presentation/colors.ts` | NEW | Semantic color constants (hex strings) |
| `src/cli/ansi.ts` | NEW | ANSI helpers with TTY/NO_COLOR guard |
| `src/cli/terminal.ts` | NEW (or inline in ansi.ts) | `isColorEnabled()` |
| `src/cli/render.ts` | MODIFIED | Add color to passage + error render |
| `src/cli/banner.ts` | MODIFIED | Export two-part split instead of monolithic string |
| `scripts/generate-banner.ts` | MODIFIED | Split figlet into two parts |
| `src/tui/welcome/welcome-screen.tsx` | MODIFIED | Two-tone banner, consume colors.ts for accent |
| `docs/ui-sketches.md` | MODIFIED | Reconcile with locked direction, restore accent token |

Unchanged:
- `src/cli/welcome-content.ts` — pure string constants, no theming concern
- `src/cli/vod.ts`, `src/cli/run.ts` — consumers of render.ts; changes propagate from render.ts
- `src/tui/tui-driver.tsx` — TTY guard already exists for TUI mode
- All domain/application/api layers — zero touch

### Risks

1. **CRITICAL: Direction conflict** — c2d4c36 explicitly removed accent. Must confirm which direction wins before any proposal. If "no hue" direction is reconsidered, docs/ui-sketches.md must be updated as part of this change.
2. **Medium: Wordmark two-tone rendering** — splitting figlet output per-character and re-zipping with colors is non-trivial. The figlet library renders the full word; splitting into "Verb" + "um" separately and joining the lines is the only clean approach. Column-counting to split a single render would be fragile (block glyphs have varying widths).
3. **Low: OpenTUI fg prop on `<text>` vs `<span>`** — TextNodeOptions (span) has `fg?: string | RGBA`. TextOptions (text) inherits from TextBufferOptions which delegates to TextBufferRenderable — fg is available via `onFgChanged`. The welcome-screen accent span for the wordmark needs to be a `<span fg={ACCENT_HEX}>` inside a `<text>`, not a `<text fg={...}>`. This is already the pattern used for DIM (span attributes={DIM}).
4. **Low: TTY detection on stderr vs stdout** — CLI render.ts writes to both stdout (passage) and stderr (errors). Color detection should key off the respective stream's `isTTY`, not just stdout. `process.stdout.isTTY` covers passage; `process.stderr.isTTY` should govern error coloring.

### Ready for Proposal

**Blocked on direction confirmation.** The proposal phase can proceed once the user confirms that the locked direction (engram #184 + #200 — accent color, three-tier hierarchy) supersedes c2d4c36's monochrome-only philosophy. If confirmed, the change is well-scoped (8 files, ~4–6 new/modified modules, zero new runtime deps). If not confirmed (monochrome wins), the scope reduces to: wordmark brightness split (no accent, just bright/dim halves) + TTY detection (mostly a no-op since there are no colors) + docs cleanup.
