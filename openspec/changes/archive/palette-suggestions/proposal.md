# Proposal: palette-suggestions

## TL;DR

Add live book-name suggestions to the `awaiting` (palette) state so that typing a partial book name (e.g. `joh`) surfaces a ranked shortlist under the input. `↑`/`↓` navigate it, `Tab` accepts, `Enter` submits as-is. No external dependencies; pure domain logic; one PR of ~246 lines.

---

## Why

Users who do not know USFM codes or canonical spelling have no feedback mechanism while typing in the palette. They type, press Enter, and get a parse error. The change closes this gap by turning the input into an incremental search — the same mental model as any modern command palette.

The project already has all the raw data needed (`BOOK_ALIASES` in `reference.ts`). The only missing pieces are: a scoring function, a thin state extension, and a view list.

---

## What Changes

### 1. `src/domain/reference.ts`

- Add `export` to the existing `BOOK_ALIASES` constant (one-word change).

### 2. `src/domain/book-suggestions.ts` (new file)

Pure module; no IO; no side effects.

- `BookSuggestion` type: `{ alias, canonical, displayName }`.
- `DISPLAY_NAMES` map — built once at module load from `BOOK_ALIASES` (longest alias per USFM code, then title-cased; numbered books via regex `"1samuel"` → `"1 Samuel"`).
- `scoreAlias(alias, q)` — subsequence check + prefix bonus (50) + exact-match bonus (100) + density bonus (`q.length / alias.length * 30`). Returns -1 if not a subsequence.
- `suggestBooks(query, limit = 5)` — runs `scoreAlias` over all ~130 entries, sorts descending, returns top `limit`.

### 3. `src/tui/reader/reader-reducer.ts`

`awaiting` variant gains two new required fields:

```ts
suggestions: BookSuggestion[];
selectedIndex: number; // -1 = nothing highlighted
```

New actions: `SuggestionMovedUp`, `SuggestionMovedDown`, `SuggestionAccepted`.

Handler changes:

| Action | Behaviour |
|--------|-----------|
| `QueryTyped` | Re-run `suggestBooks(query)`, reset `selectedIndex` to -1 |
| `SuggestionMovedDown` | Clamp at `suggestions.length - 1` |
| `SuggestionMovedUp` | Clamp at `0` (no wrap, no return to -1) |
| `SuggestionAccepted` | Set `query` to `displayName + " "`, clear `suggestions`, reset `selectedIndex` to -1 |
| `PaletteReopened` | Initialize `suggestions: [], selectedIndex: -1` |
| `initialReaderState` | Add `suggestions: [], selectedIndex: -1` |

`Enter` path is unchanged — `<input> onSubmit` fires `QuerySubmitted` directly; it never reads `selectedIndex`.

### 4. `src/tui/tui-driver.tsx`

Replace the monolithic `awaiting`-state early-return gate with a partial intercept:

```ts
if (readerState.kind === "awaiting") {
  if (keyEvent.name === "down") { dispatch({ type: "SuggestionMovedDown" }); return; }
  if (keyEvent.name === "up")   { dispatch({ type: "SuggestionMovedUp" }); return; }
  if (keyEvent.name === "tab")  { dispatch({ type: "SuggestionAccepted" }); return; }
  return; // all other keys still suppressed
}
```

`q`/`Q` quit handling remains ABOVE this block (unchanged).

### 5. `src/tui/reader/reader-screen.tsx`

Below the `<input>`, when `state.suggestions.length > 0`, render a list of up to 5 rows:

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

When `suggestions.length === 0`: no list element rendered (not even a placeholder row).

`bottomTitleFor` for `awaiting` updates to:

```
" Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit "
```

---

## What Does NOT Change

- The `loaded`, `network-error`, and `idle` state variants — untouched.
- `QuerySubmitted` / `QueryTyped` action shapes — no new fields.
- Reference parsing logic in `reference.ts` beyond the `export` keyword addition.
- The `<input>` component and its `onSubmit` wiring.
- Any non-palette screen (`reader-screen.tsx` loaded/error branches, `idle-screen.tsx`).
- HTTP / API layer.
- CLI entry points.

---

## State Machine Extension (summary)

```
awaiting (before)  →  { kind, query, parseError }
awaiting (after)   →  { kind, query, parseError, suggestions, selectedIndex }

New actions:
  SuggestionMovedUp      (awaiting only, clamp ≥ 0)
  SuggestionMovedDown    (awaiting only, clamp ≤ length-1)
  SuggestionAccepted     (awaiting only, selectedIndex ≥ 0 guard)
```

---

## Driver Gate Change (summary)

The existing `if (readerState.kind === "awaiting") return` becomes a three-way intercept (down/up/tab → dispatch → return) followed by a catch-all `return`. All other keys remain suppressed. Enter is not in this gate — it never reaches `useKeyboard` while `<input>` is focused.

---

## First Reviewable Cut

One PR touching 7 files, ~246 estimated lines, within the 400-line review budget:

| File | Change | Est. lines |
|------|--------|-----------|
| `src/domain/reference.ts` | `export const BOOK_ALIASES` | +1 |
| `src/domain/book-suggestions.ts` | new | ~55 |
| `src/domain/book-suggestions.test.ts` | new | ~70 |
| `src/tui/reader/reader-reducer.ts` | state + actions | ~35 |
| `src/tui/reader/reader-reducer.test.ts` | extend existing + new action tests | ~50 |
| `src/tui/reader/reader-screen.tsx` | suggestion list + bottom title | ~25 |
| `src/tui/tui-driver.tsx` | split awaiting gate | ~10 |
| **Total** | | **~246** |

Commit order: `reference.ts` → `book-suggestions.ts` + tests → `reader-reducer.ts` + tests → `reader-screen.tsx` → `tui-driver.tsx`.

---

## Success Criterion

1. User launches `verbum`, enters reader, types `joh`. Under the input:
   ```
     ▶ John          JHN
       1 John        1JN
       2 John        2JN
       3 John        3JN
   ```
2. Press `↓` once → "1 John" highlighted. Press `Tab` → input now reads `1 John `. Suggestions clear.
3. Type `3:16`, press `Enter` → loads 1 John 3:16.
4. Backwards path: type `xyzzy` → no suggestions shown. Press `Enter` → parse error appears.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `BOOK_ALIASES` not exported | Low | Mechanical one-word change; any import test catches the omission |
| `initialReaderState` shape change cascades to ~12 existing reducer tests | Medium | Tests are mechanical to update (add `suggestions: [], selectedIndex: -1`); they are the correct gate |
| Tab consumed by `<input>` before `useKeyboard` sees it | Medium | Must verify at apply time against a live PTY. If consumed: fall back to a different accept key (e.g. `Ctrl+Space` or an `onKeyDown` prop on `<input>`) |
| No driver-level integration tests | Low | The Tab/arrow/suggestion flow is only verifiable via manual PTY smoke; document this in the PR description |

---

## Out of Scope

- Recent references / history (separate feature)
- Chapter-level suggestions (e.g. `john 3` → chapter list)
- Full palette result sections (References / Books / Commands displayed as separate groups)
- Translation switching from the palette
- Keyboard shortcut for accepting without navigating (e.g. accepting the first suggestion without pressing `↓`)

---

## Next Steps

- **`sdd-spec`** — formal acceptance criteria, input/output contracts for `suggestBooks`, reducer action contracts
- **`sdd-design`** — file-level component diagram, module dependency graph, type definitions
- These two can run in parallel; `sdd-tasks` depends on both
