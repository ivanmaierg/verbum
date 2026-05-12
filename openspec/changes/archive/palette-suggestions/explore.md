# Exploration: palette-suggestions

## Current State (post PR #11 tui-reader-paging)

- `reader-reducer.ts` — `awaiting` variant: `{ kind: "awaiting"; query: string; parseError: ParseError | null }`. No suggestion state.
- `reader-screen.tsx` — awaiting branch renders: hint text, `<input>` (focused), optional parse-error text. No suggestion list.
- `tui-driver.tsx` — `useKeyboard` gates ALL reader keybinds behind `if (readerState.kind === "awaiting") return`. Arrow keys and Tab are completely suppressed while input is focused.
- `BOOK_ALIASES` in `src/domain/reference.ts` — ~130 entries. Keyed by lower-case alias → USFM code. No pretty display names. Aliases are the canonical names (e.g. `"john"`, `"genesis"`) plus abbreviations.
- No `BOOK_DISPLAY_NAMES` table exists. Display names must be derived.
- OpenTUI tab key name confirmed: `keyEvent.name === "tab"`.

## 1. Match Algorithm

| Approach | Pros | Cons |
|----------|------|------|
| A — Substring (case-insensitive) | Trivial | Misses "jhn" → "john" |
| **B — Subsequence + light scoring (recommended)** | Handles abbreviations naturally; no external dep; 130 entries is trivial | Slightly more code than substring |
| C — Fuzzy/Levenshtein | Handles typos | Over-engineered; surprising results |

**Recommendation: B.** Score = prefix bonus (50) + exact-match bonus (100) + density bonus (`q.length / alias.length * 30`).

## 2. Suggestion Shape

```ts
export type BookSuggestion = {
  alias: string;      // matched alias key (e.g. "john")
  canonical: string;  // USFM code (e.g. "JHN")
  displayName: string; // pretty name (e.g. "John")
};
```

**Display name source: derive from longest alias per USFM code at module load.** Zero-maintenance — inherits any future alias additions. Numbered books (`"1samuel"` → `"1 Samuel"`) handled by a simple regex transform.

## 3. Pure Suggester Location

**`src/domain/book-suggestions.ts`** — pure, no IO, no deps. Imports `BOOK_ALIASES` from `reference.ts` (must be exported — see Risks).

```ts
export function suggestBooks(query: string, limit = 5): BookSuggestion[];
```

## 4. State Machine Extension

New `awaiting`:
```ts
| {
    kind: "awaiting";
    query: string;
    parseError: ParseError | null;
    suggestions: BookSuggestion[];
    selectedIndex: number; // -1 = no selection
  }
```

New actions:
- `SuggestionMovedUp` / `SuggestionMovedDown` — clamp at edges (0 and length-1; do not wrap)
- `SuggestionAccepted` — rewrite `query` to `displayName + " "` (trailing space, ready for chapter), reset `suggestions: []`, `selectedIndex: -1`

`QueryTyped` recomputes `suggestions` and resets `selectedIndex` to -1. `PaletteReopened` initializes the new fields. `initialReaderState` adds `suggestions: [], selectedIndex: -1`.

**Enter vs Tab**: Enter ALWAYS submits (via `<input> onSubmit` → `QuerySubmitted`). Tab ALWAYS accepts the selected suggestion (via `useKeyboard`). No ambiguity.

## 5. View Extension

Below the input, when `suggestions.length > 0`:

```tsx
{state.suggestions.map((s, i) => (
  <text key={s.canonical}>
    <span fg={i === state.selectedIndex ? ACCENT_HEX : undefined}>
      {i === state.selectedIndex ? "  ▶ " : "    "}
    </span>
    <span fg={i === state.selectedIndex ? ACCENT_HEX : undefined}>{s.displayName}</span>
    <span attributes={DIM}>{`  ${s.canonical}`}</span>
  </text>
))}
```

When `suggestions.length === 0`: hide the list entirely.

`bottomTitleFor` for awaiting: `" Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit "`.

## 6. Driver-Level Keybind Changes

Split the existing `awaiting`-state gate to allow specific keys through:

```ts
if (readerState.kind === "awaiting") {
  if (keyEvent.name === "down") { dispatch({ type: "SuggestionMovedDown" }); return; }
  if (keyEvent.name === "up")   { dispatch({ type: "SuggestionMovedUp" }); return; }
  if (keyEvent.name === "tab")  { dispatch({ type: "SuggestionAccepted" }); return; }
  return;
}
```

`q`/`Q` quit must remain ABOVE this block.

## 7. Constraint: `BOOK_ALIASES` export

Currently `const` (module-private) in `reference.ts`. Must be exported. Recommend single-line `export const BOOK_ALIASES = { ... }`.

## 8. Slicing

One PR, ~246 lines:

| File | Estimate |
|------|----------|
| `src/domain/reference.ts` | +1 (export) |
| `src/domain/book-suggestions.ts` (new) | ~55 |
| `src/domain/book-suggestions.test.ts` (new) | ~70 |
| `src/tui/reader/reader-reducer.ts` | ~35 |
| `src/tui/reader/reader-reducer.test.ts` | ~50 |
| `src/tui/reader/reader-screen.tsx` | ~25 |
| `src/tui/tui-driver.tsx` | ~10 |
| **Total** | **~246** |

Under the 400-line budget.

## Risks

1. **`BOOK_ALIASES` not exported** — trivial fix, but easy to forget.
2. **`initialReaderState` shape change** — ~12 existing reducer tests that assert the awaiting shape will need `suggestions: [], selectedIndex: -1` added. Mechanical but volume.
3. **Tab consumed by `<input>` before `useKeyboard`** — needs runtime verification at apply time. If consumed, fall back to a different accept key (Ctrl+Space, Esc-then-Enter, or a `keyEvent`-listener on the input itself).
4. **No driver-level test infrastructure** — Tab/arrow behavior in awaiting state verifiable only via manual PTY smoke.

## Open Questions Resolved

| Question | Decision |
|----------|----------|
| Display name source | Derived from longest alias per USFM code at module load |
| Match algorithm | Subsequence + light scoring |
| Tab vs Enter to accept | Tab = accept. Enter = submit. |
| 0 suggestions behavior | Hide list entirely |
| selectedIndex edge behavior | Clamp (no wrap) |

## Ready for Proposal

Yes. Primary risk (Tab consumption) is a verification step for apply, not a blocker for proposal.
