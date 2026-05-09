# UI Sketches

Visual design for the TUI. ASCII mockups, style legend, focus states, and the rules that keep every screen consistent. This doc complements [user-flow.md](user-flow.md) (which says *what* views exist and *how* they connect) by showing *what they look like*.

## Style legend

OpenTUI supports color, borders, padding, dim/bright contrast, and focus highlighting. We use these deliberately, not decoratively.

| Token | Purpose | Example |
|---|---|---|
| `primary` | Reading text, default UI | verse text, list items |
| `accent` | Active selection, focus highlight | `▶` indicator, current verse, reference header |
| `muted` | Secondary information | verse numbers, dividers, hints |
| `dim` | Background views behind overlays | reading view when palette is open |
| `error` | Errors and warnings | "Could not parse reference" |
| `success` | Confirmations | "Translation saved" |

Borders: rounded corners on overlays (palette, pickers); square borders on full-screen views.

## Visual identity

The brand is **`verbum`** — Latin for "the Word" (John 1:1). The wordmark is rendered with `figlet` using the **Isometric1** font, generated at build/runtime via `bunx figlet -f Isometric1 verbum`.

### Welcome screen (first run + `verbum --help`)

The full identity composition: Isometric1 wordmark over a 3D open-book frame with two pages of foundational scripture.

```
              ___           ___           ___           ___           ___
             /\__\         /\  \         /\  \         /\  \         /\__\
            /:/  /        /::\  \       /::\  \       /::\  \       /:/  /
           /:/  /        /:/\:\  \     /:/\:\  \     /:/\:\  \     /:/  /
          /:/__/  ___   /::\~\:\  \   /::\~\:\  \   /::\~\:\__\   /:/  /  ___
          |:|  | /\__\ /:/\:\ \:\__\ /:/\:\ \:\__\ /:/\:\ \:|__| /:/__/  /\__\
          |:|  |/:/  / \:\~\:\ \/__/ \/_|::\/:/  / \:\~\:\/:/  / \:\  \ /:/  /
          |:|__/:/  /   \:\ \:\__\      |:|::/  /   \:\ \::/  /   \:\  /:/  /
           \::::/__/     \:\ \/__/      |:|\/__/     \:\/:/  /     \:\/:/  /
            ~~~~          \:\__\        |:|  |        \::/__/       \::/  /
                           \/__/         \|__|         ~~            \/__/

              ___________________________________________________
            ╱                                                    ╲
          ╱                                                        ╲
        ╱─────────────────────────────────────────────────────────────╲
       │                                │                              │
       │   In the                       │   For God so loved           │
       │   beginning                    │   the world that He          │
       │   God created                  │   gave His only Son,         │
       │   the heavens                  │   that all who believe       │
       │   and the earth.               │   shall not perish.          │
       │                                │                              │
       │   ✦ Genesis 1:1                │   ✦ John 3:16                │
        ╲─────────────────────────────────────────────────────────────╱
          ╲                       v0.1.0                              ╱
            ╲___________________________________________________________╱
              ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

The 3D effect comes from:

- Angled `╱` / `╲` edges suggesting an open book on a desk
- Drop shadow `░░░` anchoring it on the surface
- The Isometric1 wordmark's true-3D letterforms (built from `/\`, `:/\:`, `/__/` blocks)

### `verbum --version` (compact)

When the welcome screen is overkill, just the wordmark plus a one-line tagline:

```
$ verbum --version

      ___           ___           ___           ___           ___
     /\__\         /\  \         /\  \         /\  \         /\__\
    /:/  /        /::\  \       /::\  \       /::\  \       /:/  /
   /:/  /        /:/\:\  \     /:/\:\  \     /:/\:\  \     /:/  /
  /:/__/  ___   /::\~\:\  \   /::\~\:\  \   /::\~\:\__\   /:/  /  ___
  |:|  | /\__\ /:/\:\ \:\__\ /:/\:\ \:\__\ /:/\:\ \:|__| /:/__/  /\__\
  |:|  |/:/  / \:\~\:\ \/__/ \/_|::\/:/  / \:\~\:\/:/  / \:\  \ /:/  /
  |:|__/:/  /   \:\ \:\__\      |:|::/  /   \:\ \::/  /   \:\  /:/  /
   \::::/__/     \:\ \/__/      |:|\/__/     \:\/:/  /     \:\/:/  /
    ~~~~          \:\__\        |:|  |        \::/__/       \::/  /
                   \/__/         \|__|         ~~            \/__/

  v0.1.0  ·  read scripture in your terminal  ·  bible.helloao.org
```

### The motif: `✦`

Used as a subtle accent throughout:

- Section dividers in lists (`─── ✦  Old Testament  ✦ ───`)
- Verse markers in the welcome screen (`✦ Genesis 1:1`)
- Bullet points in the help screen
- Empty-state decorations

**Where ASCII art does *not* go:** the Reading view itself. Verses must breathe — no decoration around scripture. The art is for entry points (welcome, `--version`, `--help`) and quiet accents (section dividers).

### Generation

The figlet wordmark is generated at build time, not hand-typed in source. A small build step writes it to `src/cli/banner.ts` as a string constant. This means:

- We can change the font / wordmark in one place by changing the `figlet` invocation
- No risk of someone editing the ASCII manually and breaking alignment
- The figlet npm package becomes a `devDependency` only — not shipped at runtime

## Reading view

The default and most-used view. Header shows the current reference and translation. Body is the chapter content. Status bar shows hint keybindings.

```
┌─ John 3 ─ Berean Standard Bible ─────────────────────────────────┐
│                                                                  │
│  14 Just as Moses lifted up the snake in the wilderness, so      │
│     must the Son of Man be lifted up,                            │
│                                                                  │
│  15 that everyone who believes in Him may have eternal life.     │
│                                                                  │
│▶ 16 For God so loved the world that He gave His one and only     │
│     Son, that everyone who believes in Him shall not perish      │
│     but have eternal life.                                       │
│                                                                  │
│  17 For God did not send His Son into the world to condemn the   │
│     world, but to save the world through Him.                    │
│                                                                  │
│  18 Whoever believes in Him is not condemned, but whoever does   │
│     not believe has already been condemned, because they have    │
│     not believed in the name of God's one and only Son.          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  j/k scroll  •  n/p chapter  •  Ctrl+K palette  •  q quit        │
└──────────────────────────────────────────────────────────────────┘
```

**Visual rules:**

- Verse number: `muted`, right-aligned in a 3-char gutter
- Verse text: `primary`
- Focused verse: `accent` color on the line + `▶` marker in the gutter
- Reference header: `accent`, bold
- Translation tag: `muted`

## Book List view

All 66 books, grouped by Old / New Testament. Two-column layout uses width efficiently. Filter input lives at the top.

```
┌─ Books ─ Berean Standard Bible ──────────────────────────────────┐
│  Filter:                                                         │
│                                                                  │
│  Old Testament (39)                                              │
│  ▶ Genesis        50 chapters       Exodus         40 chapters   │
│    Leviticus      27 chapters       Numbers        36 chapters   │
│    Deuteronomy    34 chapters       Joshua         24 chapters   │
│    Judges         21 chapters       Ruth            4 chapters   │
│    1 Samuel       31 chapters       2 Samuel       24 chapters   │
│    1 Kings        22 chapters       2 Kings        25 chapters   │
│    ...                                                           │
│                                                                  │
│  New Testament (27)                                              │
│    Matthew        28 chapters       Mark           16 chapters   │
│    Luke           24 chapters       John           21 chapters   │
│    Acts           28 chapters       Romans         16 chapters   │
│    ...                                                           │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  type to filter  •  j/k move  •  Enter open  •  Esc back  •  q   │
└──────────────────────────────────────────────────────────────────┘
```

When filtering, non-matching items disappear and the matches collapse into a single section:

```
┌─ Books ─ Berean Standard Bible ──────────────────────────────────┐
│  Filter: joh_                                                    │
│                                                                  │
│  Matches (4)                                                     │
│  ▶ John          21 chapters                                     │
│    1 John         5 chapters                                     │
│    2 John         1 chapter                                      │
│    3 John         1 chapter                                      │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  type to filter  •  j/k move  •  Enter open  •  Esc clear        │
└──────────────────────────────────────────────────────────────────┘
```

## Chapter List view

For one book, all chapters laid out as a numeric grid. Quick to scan, easy to jump.

```
┌─ John ─ 21 chapters ─ Berean Standard Bible ─────────────────────┐
│                                                                  │
│   ▶ 1     2     3     4     5     6     7     8     9    10     │
│    11    12    13    14    15    16    17    18    19    20     │
│    21                                                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  hjkl move  •  Enter open  •  Esc back to books  •  q quit       │
└──────────────────────────────────────────────────────────────────┘
```

Each chapter cell is a fixed width (5 chars). Selected chapter has `accent` background; unselected use `muted` background.

## Translation Picker (overlay)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              ╭────────────────────────────────────╮              │
│              │  Switch translation                │              │
│              │  Filter:                           │              │
│              ├────────────────────────────────────┤              │
│              │  ★ Favorites                       │              │
│              │  ▶ Berean Standard Bible (current) │              │
│              │    King James Version              │              │
│              │    Reina-Valera 1960               │              │
│              │                                    │              │
│              │  All translations                  │              │
│              │  English                           │              │
│              │    New International Version       │              │
│              │    English Standard Version        │              │
│              │  Spanish                           │              │
│              │    Nueva Versión Internacional     │              │
│              │  ...                               │              │
│              ╰────────────────────────────────────╯              │
│   (reading view dimmed in background)                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Layout:** Favorites section at the top (if any exist), then all translations grouped by language. Current translation marked `(current)`. With 1000+ translations available from helloao.org, favorites turn the picker from "endless scroll" into "two clicks."

**Interactions:**

- Type any letter → filter activates (search bar)
- `j/k` move selection
- `Enter` → switch to that translation
- `f` → toggle favorite on the highlighted translation (picker stays open, star marker animates in/out)
- `Esc` → dismiss

When filtering, both sections are searched together; matches preserve their section grouping.

## Command Palette (overlay) — the spine of the TUI

Centered overlay; whatever view is behind dims to `dim`. Three result sections: References, Books, Commands. Top result auto-highlighted.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│             ╭───────────────────────────────────────╮            │
│             │ ▶ john 3_                             │            │
│             ├───────────────────────────────────────┤            │
│             │ References                            │            │
│             │ ▶ John 3        Gospel of John (36v)  │            │
│             │   1 John 3      Epistle (24v)         │            │
│             │                                       │            │
│             │ Books                                 │            │
│             │   Browse John (chapter list)          │            │
│             │                                       │            │
│             │ Commands                              │            │
│             │   Switch translation                  │            │
│             │   Show keybindings                    │            │
│             │   Quit                                │            │
│             ╰───────────────────────────────────────╯            │
│                                                                  │
│  Tab complete  •  ↑↓ move  •  Enter open  •  Esc cancel          │
└──────────────────────────────────────────────────────────────────┘
```

Section headers (`References`, `Books`, `Commands`) are `muted`, slightly indented, no separator. Empty sections are hidden entirely (e.g. typing "asdf" hides the References section).

## Error states

Errors are loud and actionable. Never silent.

### Network error (cold reference, no cache)

```
┌─ John 3 ─ Berean Standard Bible ─────────────────────────────────┐
│                                                                  │
│   ⚠ Could not load this chapter.                                 │
│                                                                  │
│     The Bible API is unreachable, and this chapter isn't         │
│     in the local cache yet.                                      │
│                                                                  │
│     Try:                                                         │
│       • Check your network                                       │
│       • Switch to a previously-read translation/chapter          │
│       • Run `verbum cache list` to see what's available offline   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Ctrl+K palette  •  q quit                                       │
└──────────────────────────────────────────────────────────────────┘
```

The `⚠` glyph and message body are `error`. Action items stay `primary`.

### Parse error (palette, non-blocking)

In the palette, parse failures don't interrupt — we just hide the References section:

```
╭───────────────────────────────────────╮
│ ▶ asdf_                               │
├───────────────────────────────────────┤
│ Commands                              │
│   Show keybindings                    │
│   Quit                                │
╰───────────────────────────────────────╯
```

The user keeps typing or hits Esc. No error overlay, no popup.

## First-run / empty states

### First run (no preferences yet)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│         Welcome to verbum                                     │
│                                                                  │
│         Pick a translation to get started:                       │
│                                                                  │
│              ╭────────────────────────────────────╮              │
│              │  Filter:                           │              │
│              ├────────────────────────────────────┤              │
│              │  English                           │              │
│              │  ▶ Berean Standard Bible           │              │
│              │    King James Version              │              │
│              │    New International Version       │              │
│              │  Spanish                           │              │
│              │    Reina-Valera 1960               │              │
│              ╰────────────────────────────────────╯              │
│                                                                  │
│         You can change this anytime with Ctrl+K → "translation"  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## CLI output formats

Three output modes, selectable with `--format`. The default is TTY-aware (`text`).

### Default — TTY interactive

```
$ verbum john 3:16

  John 3:16 — Berean Standard Bible

  16 For God so loved the world that He gave His one and only
     Son, that everyone who believes in Him shall not perish
     but have eternal life.
```

Reference header in `accent` bold. Verse number in `muted`. Verse text in `primary`. Soft-wrapped at terminal width.

### Default — piped (auto-detected non-TTY)

```
$ verbum john 3:16 | cat
John 3:16 (BSB)
16 For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.
```

No colors, no soft-wrapping (single line per verse), single newline between header and content. Stable and grep-friendly.

### `--format markdown`

```
$ verbum john 3:16 --format markdown
> **John 3:16** — *Berean Standard Bible*
>
> <sup>16</sup> For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.
```

Paste-friendly into notes, README files, or messages. Verse numbers as `<sup>` so they render small in any markdown viewer.

### `--format json`

```
$ verbum john 3:16 --format json
{
  "translation": {
    "id": "BSB",
    "name": "Berean Standard Bible",
    "language": "eng"
  },
  "reference": {
    "book": "JHN",
    "bookName": "John",
    "chapter": 3,
    "verses": [16]
  },
  "verses": [
    {
      "number": 16,
      "text": "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life."
    }
  ]
}
```

Schema-stable across versions. Each verse is a discrete object — an LLM can quote them individually without parsing prose. This is the foundation v11 (MCP server mode) builds on.

## Layout rules

| Element | Rule |
|---|---|
| Header height | 1 content line + 1 border line = 2 |
| Status bar | 1 content line + 1 border line, always at bottom |
| Vertical padding inside sections | 1 line |
| Horizontal padding inside borders | 2 chars |
| Minimum terminal size | 60 cols × 20 rows (gracefully degrade below) |
| Overlays (palette, picker) | centered, 80% width up to 60 chars max, height fits content |

## Typography

| Element | Style |
|---|---|
| Verse text | `primary`, normal weight |
| Verse number | `muted`, right-aligned in 3-char gutter |
| Focused verse | `accent` background or left bar marker |
| Reference header | `accent`, bold |
| Translation tag | `muted`, italic or in parens |
| Section headers (in palette / lists) | `muted`, slight indent |
| Footnote markers | `accent`, superscript-style |
| Keybind hints in status bar | `muted`, separated by `•` |

## What this doc is *not*

- **Not a CSS / theme spec.** Color values get picked when we hook up OpenTUI's theme system. This doc describes *intent*, not hex codes.
- **Not implementation.** The actual component code references this doc but lives in `src/tui/components/`.
- **Not the user manual.** That's the README at ship time.
