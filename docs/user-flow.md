# User Flow

How users interact with `verbum` — the journeys, the modes, the navigation model. This doc bridges architecture (what the system *is*) and UI (what users *see*). Detailed visual mockups live in `ui-sketches.md` (separate doc).

## TL;DR

- **Two modes from one binary.** `verbum <ref>` for one-shot output; `verbum` for the TUI.
- **Routing rule: only verse-level references go one-shot CLI.** Everything else opens the TUI.
- **Command palette (`Ctrl+K`) is the spine of the TUI.** Type anything — book name, reference, action — fuzzy-filtered, Enter to dispatch.
- **Shell completion** (`verbum <TAB>`) covers the CLI side. Users should never type a book name in full anywhere.

## Modes of interaction

| Mode | Trigger | Purpose | Exit |
|---|---|---|---|
| **One-shot CLI** | `verbum <book> <chapter>:<verse>` (verse specified) | Print and exit; pipe-friendly | Exits after output |
| **TUI** | `verbum` (no args) OR any incomplete reference | Browse, read, navigate; sticky | Runs until user quits |

Both modes call the same use cases. The decision lives in `src/index.tsx` based on argv and the parse result.

## Routing rule

The reference's specificity decides the mode:

| Input | Mode | Behavior |
|---|---|---|
| `verbum` | TUI | Last position (or first-run flow) |
| `verbum <book>` | TUI | Chapter List view, scoped to that book |
| `verbum <book> <chapter>` | TUI | Reading view at that chapter |
| `verbum <book> <chapter>:<verse>` | CLI | Print verse, exit |
| `verbum <book> <chapter>:<v1>-<v2>` | CLI | Print range, exit |
| `verbum books` (subcommand) | TUI | Book browser as entry point |
| `verbum cache <subcmd>` | CLI | Cache management; print result, exit |
| `verbum completion <shell>` | CLI | Emit completion script to stdout |

The principle: **specific enough to print → print. Otherwise → navigate.**

## Intents (what users come to do)

| Intent | Path | v1? |
|---|---|---|
| "Show me this verse, now" | `verbum john 3:16` | ✅ |
| "Show me this chapter" | `verbum psalm 23` → TUI reading view | ✅ |
| "I want to read for a while" | `verbum` → TUI | ✅ |
| "Browse all books" | `verbum books` or `Ctrl+K` "books" | ✅ |
| "Find a book by partial name" | Fuzzy filter / palette | ✅ |
| "Switch translation" | `Ctrl+K` "translation" | ✅ |
| "Favorite a translation for quick access" | Translation Picker → press `f` | ✅ |
| "Resume where I left off" | `verbum` → TUI at last position | ✅ |
| "Pipe a verse to clipboard" | `verbum john 3:16 \| pbcopy` | ✅ |
| "Find verses about X" | Palette / search | v4 |
| "Bookmark this" | `Ctrl+K` "bookmark" | v2 |
| "Compare two translations" | Palette / parallel view | v5 |

## TUI views

Five views in v1, each with a single responsibility:

| View | Entered from | Primary action |
|---|---|---|
| **Reading** | App boot, palette ref-dispatch, list selection | Read passages, scroll, navigate chapters |
| **Book List** | `verbum books`, palette "books" | Pick a book |
| **Chapter List** | `verbum <book>`, palette "<book>", or from Book List | Pick a chapter within a book |
| **Translation Picker** | Palette "translation" | Switch active translation |
| **Command Palette** | `Ctrl+K` from anywhere | Dispatch a reference, run an action |

## Navigation hierarchy

```
            ┌──────────────┐
            │  Book List   │  ← `verbum books` or palette "books"
            └──────┬───────┘
                   │ Enter
                   ▼
            ┌──────────────┐
            │ Chapter List │  ← `verbum <book>` or palette "<book>"
            └──────┬───────┘
                   │ Enter
                   ▼
            ┌──────────────┐
            │ Reading View │  ← `verbum <book> <ch>` or palette ref / list selection
            └──────────────┘
```

`Esc` always goes one level up. The Command Palette and Translation Picker are **overlays** — they appear above the current view and dismissing returns to it. They are not part of the hierarchy.

## Command palette (Ctrl+K) — the spine of the TUI

Pressing `Ctrl+K` (or `:`) anywhere opens an overlay with a fuzzy-filtered input. The palette dispatches **both references and commands**:

- Type `john 3:16` → top result is "John 3:16" → Enter → reading view at the verse
- Type `psalm` → "Psalms — 150 chapters", "Psalm 23", "Psalm 119"…
- Type `translation` → "Switch translation" command
- Type `niv` → "Switch to NIV (New International Version)"
- Type `help` → "Show keybindings"
- Type `quit` → quit command

Behavior:

- Reading view stays visible behind the palette, dimmed
- `↑/↓` (or `j/k`) move selection
- `Tab` accepts the top suggestion as input (keep typing)
- `Enter` dispatches the selected result
- `Esc` cancels and dismisses

## Fuzzy filter — reusable primitive

Used in: Book List, Chapter List, Translation Picker, Command Palette. Same component, different data source. **One implementation, four use cases.**

Behavior: type → live-filter results → match by substring **and** fuzzy match (transposed letters, abbreviations).

Examples:

- `joh` matches "John", "1 John", "2 John", "3 John", "Joel"
- `1cor` matches "1 Corinthians" (alias-aware)
- `kjv` matches "King James Version" in the translation picker

## Keybindings

Direct keybinds are kept minimal. The palette is the universal launcher.

### Reading view

| Key | Action |
|---|---|
| `j` / `↓` | Scroll down one verse |
| `k` / `↑` | Scroll up one verse |
| `n` | Next chapter |
| `p` | Previous chapter |
| `N` | Next book |
| `P` | Previous book |
| `Ctrl+K` or `:` | Open command palette |
| `Esc` | Back (to Chapter List, or close TUI if no parent) |
| `q` | Quit (saves position) |

### List views (Book / Chapter / Translation Picker)

| Key | Action |
|---|---|
| `j` / `↓` | Next item |
| `k` / `↑` | Previous item |
| Any letter | Begin filtering (the search bar at the top of the view) |
| `Enter` | Select |
| `Esc` | Back / clear filter |
| `Ctrl+K` or `:` | Open palette (overlays) |
| `q` | Quit |

**Translation Picker only:**

| Key | Action |
|---|---|
| `f` | Toggle favorite on the highlighted translation (picker stays open) |

### Command palette overlay

| Key | Action |
|---|---|
| `↑` / `↓` | Move selection |
| `Tab` | Accept top suggestion as input |
| `Enter` | Dispatch |
| `Esc` | Cancel |

## Mouse support

The TUI is **keyboard-first** — every action has a keybinding — but **mouse works as a parallel input** for pointer-comfortable users. Native via OpenTUI (`useMouse: true` at the renderer level; components register `onMouseDown` handlers that dispatch to the same actions as keyboard).

| Action | Mouse | Keyboard equivalent |
|---|---|---|
| Focus a verse (Reading view) | Click verse | `j` / `k` |
| Scroll | Mouse wheel | `j` / `k` |
| Open a book (Book List) | Click book row | `Enter` |
| Open a chapter (Chapter List) | Click chapter cell | `Enter` |
| Select a translation | Click translation row | `Enter` |
| Toggle favorite (Translation Picker) | Click the `★` glyph next to a translation | `f` |
| Run a palette command/reference | Click result row | `Enter` |
| Dismiss overlay | Click outside the overlay | `Esc` |

Mouse and keyboard dispatch the **same use cases** — there are no mouse-only or keyboard-only features. This keeps the architecture symmetric: input source is a presentation concern, not a domain one.

## Shell completion (CLI side)

Implemented via `verbum completion bash|zsh|fish` — emits a completion script the user installs once. After install:

```bash
$ verbum <TAB>
books     cache     completion     genesis     exodus     leviticus     ...

$ verbum john <TAB>
1   2   3   4   5   6   7   8   9   10   ...   21

$ verbum 1<TAB>
1cor   1jn   1kgs   1pet   1sam   1thess   1tim   1chr   1john
```

Suggestions are static (66 books + aliases) plus context-aware chapter ranges per book.

## CLI output formats

`verbum <ref>` (one-shot mode) supports three output formats via `--format`:

| Format | When to use |
|---|---|
| `text` (default) | TTY-aware: colors when interactive, plain when piped |
| `json` | Structured, schema-stable. For scripting and LLM tool use |
| `markdown` | Paste-friendly for notes, READMEs, or LLM redisplay |

Detailed examples in `ui-sketches.md`. Implementation pattern in [ADR 0007](decisions/0007-output-formatters.md).

The schema-stable JSON output is the foundation for v11 (LLM/MCP integration) — once we ship a stable structured format, an MCP server is a thin transport adapter on top of the same use cases.

## Core flows

### Flow 1 — One-shot verse lookup (CLI)

1. User types `verbum john 3:16`
2. `ReferenceParser` resolves `"john"` → `JHN`, `"3:16"` → chapter 3 verse 16
3. App calls the `GetPassage` use case
4. `CachingBibleRepository` checks cache → on miss, fetches → writes to cache
5. App filters chapter response to verse 16
6. Output: formatted verse with reference + translation tag (colors when TTY, plain when piped)
7. Exit code `0`

**Variations:**

- `verbum jn 3:16` — alias resolves to the same book
- `verbum "1 cor 13:4-7"` — range query, prints all verses in range

### Flow 2 — Browse a book (TUI launched from CLI)

1. User types `verbum john` (no chapter)
2. Parser detects "book only" → routes to TUI
3. TUI opens at Chapter List view, scoped to John (21 chapters)
4. User navigates with `j/k` or types to filter; `Enter` opens Reading view

### Flow 3 — Read interactively (TUI sticky)

1. User runs `verbum` with no args
2. App reads `PreferencesStore` → finds last-read position (or first-run flow)
3. TUI opens at Reading view at that passage
4. User scrolls, navigates chapters/books, opens palette as needed
5. On quit (`q` or `Ctrl+C`), current position is written to `PreferencesStore`

### Flow 4 — Use the command palette

1. User presses `Ctrl+K` from any view
2. Palette overlay opens; current view dims behind it
3. User types `john 3` → suggestions appear ("John 3 — Gospel of John", "1 John 3", "Browse John")
4. User picks a suggestion with `↑/↓` and `Enter`
5. Palette dismisses; selected action executes (jump to passage, open picker, etc.)

### Flow 5 — Switch translation (and favorite one)

1. User presses `Ctrl+K`, types "translation" → "Switch translation" surfaces
2. Selecting it opens the Translation Picker — favorites section at the top, then all translations grouped by language
3. User filters with the search bar (e.g. "niv") OR navigates to a favorite
4. `Enter` selects → active translation changes; current reference is re-fetched in the new translation
5. **Or** with a translation highlighted, press `f` to toggle favorite — the star marker appears/disappears, persists to `PreferencesStore`, picker stays open
6. Reading view updates in place

### Flow 6 — First run

1. User runs `verbum` for the first time — no preferences exist
2. App fetches `/api/available_translations.json`
3. Translation Picker opens with translations grouped by language
4. User selects → set as default, written to `PreferencesStore`
5. Drops into Reading view at Genesis 1

### Flow 7 — Reference parse error (CLI)

1. User types `verbum asdf`
2. `ReferenceParser` returns `ParseError`
3. Output: clear error message + suggested formats
4. Exit code `1`

```
Couldn't parse reference: "asdf"

Try:
  bible john 3:16
  bible "1 cor 13:4-7"
  bible psalm 23
```

## Edge cases

- **Network down on cold reference.** Fall back to a cached chapter in the same translation if any; otherwise show a clear network error.
- **Verse range crosses chapter boundary.** Not supported in v1 — error with a suggestion to query each chapter separately.
- **Ambiguous book name** (e.g. "john"). Default to the gospel; expose `1jn`, `2jn`, `3jn` as explicit alternatives. The palette and shell completion both surface all four.
- **TUI quit during translation switch.** Position is saved as the new translation's reference, not the old.
- **First-run with no network.** Show error explaining we need network access for the initial translation list — there's nothing cached yet.
- **TTY detection for CLI output.** When stdout is a pipe, emit plain text and ASCII; when interactive, emit colors and pretty formatting.

## What this doc is *not*

- **Not the visual design.** Detailed mockups, colors, exact widget chrome → `ui-sketches.md` (separate doc).
- **Not a user manual.** That's the README at ship time.
- **Not the implementation plan.** This describes intent and behavior, not file structure or sequencing.
