# UI Sketches

Visual design for the TUI. ASCII mockups, style legend, focus states, and the rules that keep every screen consistent. This doc complements [user-flow.md](user-flow.md) (which says *what* views exist and *how* they connect) by showing *what they look like*.

## Style legend

verbum is **monochrome with one accent**. One reserved hue (accent blue) signals interactivity; everything else is default fg / `dim` / `bold` / `inverse`. Every visual distinction is carried by terminal *attributes* plus glyphs, layout, and the single accent token. We respect the user's terminal theme — the accent is one fixed truecolor value that degrades gracefully — and `NO_COLOR` disables all escapes when set.

| Token | OpenTUI attribute / escape | Purpose | Example |
|---|---|---|---|
| `text` | default fg, no attrs | The focal content — what the user came to read | verse text, palette query, list items |
| `muted` | `TextAttributes.DIM` | Everything that frames or labels the focal content | borders, references, verse numbers, hints, drop shadows, status bar, section headers |
| `accent` | truecolor `#5BA0F2` (opencode blue) | Signals interactivity or the wordmark; one reserved hue | wordmark "um" half, focused verse indicator, reference header |
| `error` | ANSI 31 (standard red) | CLI error output; gated on `isColorEnabled(stderr)` | parse errors, network errors |
| `emphasis` | `TextAttributes.BOLD` | Used sparingly for headers and warnings that need weight without a hue | reference header in Reading view, error title |
| `selection` | `TextAttributes.INVERSE` | Active selection / focus highlight (replaces what color usually does) | currently-focused verse, palette top result, picker highlight |
| `marker` | glyph in the gutter | Pre-attribute pointer that survives in piped output | `▶` next to the focused row |

**The rule that drives every styling decision: accent is the only hue.** Secondary elements fade via `dim`; the primary content stays at fg default. The single accent token marks what the user can act on. This keeps scripture visually loudest while the one hue guides attention.

Borders: rounded corners on overlays (palette, pickers); square borders on full-screen views. Border characters themselves are `muted`.

## Visual identity

The brand is **`verbum`** — Latin for "the Word" (John 1:1). The wordmark is rendered with `figlet` using the **ANSI Shadow** font, split into two halves: `"Verb"` (dim) and `"um"` (accent blue), generated at build time by `bun run generate:banner` (script: `scripts/generate-banner.ts`) and committed to `src/cli/banner.ts` as two string constants (`BANNER_DIM_PART`, `BANNER_ACCENT_PART`). The two-tone wordmark embodies the accent direction: one hue, one purpose.

### Color philosophy

Three tiers govern every surface. Everything maps to exactly one of them:

1. **`text`** — default fg, no attributes. Verse text always lives here. It is the only fully-lit thing on screen. Never dim, never decorated.
2. **`muted`** — `TextAttributes.DIM`. Everything that frames or guides: borders, reference labels, chrome, hints, drop shadows. Fades so the verse breathes.
3. **`accent`** (`#5BA0F2`, opencode blue) — one reserved hue. Used only where interactivity or identity must be named: the wordmark "um" half, focused state indicators, and the reference header in the Reading view. Gated on `isColorEnabled` so it degrades to plain text in pipes and `NO_COLOR` environments.

Error output uses the `error` token (ANSI 31 red) on `stderr`, also `isColorEnabled`-gated. It is not part of the three content tiers — it is a system signal, not a content attribute.

**Verses must breathe.** Verse text is always `text` — never dim, never bold, never inverse, never decorated. The chrome fades; the verse stays at full weight.

Red-letter editions (Jesus's words in red) were considered and explicitly rejected as a default. If revisited later, only as an opt-in toggle, never on by default.

### Welcome screen (first run + `verbum --help`)

The full identity composition: ANSI Shadow wordmark with the version right-aligned beneath it, then a two-page open-book frame whose top edges meet in a peak, a drop shadow anchoring it to the surface, and a bookmark ribbon hanging off the spine. Verses inside the book stay at default fg; everything else (chrome, refs, shadow, ribbon, hint) is `muted`.

```

██╗   ██╗███████╗██████╗ ██████╗ ██╗   ██╗███╗   ███╗
██║   ██║██╔════╝██╔══██╗██╔══██╗██║   ██║████╗ ████║
██║   ██║█████╗  ██████╔╝██████╔╝██║   ██║██╔████╔██║
╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══██╗██║   ██║██║╚██╔╝██║
 ╚████╔╝ ███████╗██║  ██║██████╔╝╚██████╔╝██║ ╚═╝ ██║
  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝
                                               v0.1.0

 ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲
│  ✦ Genesis 1:1                    │  ✦ John 3:16                      │
│   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾ │ ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾   │
│  In the beginning God created the │  For God so loved the world that  │
│  heavens and the earth.           │  He gave His one and only Son,    │
│                                   │  that everyone who believes in    │
│                                   │  Him shall not perish but have    │
│                                   │  eternal life.                    │
│                                   │                                   │
 ╲__________________________________╲╱_________________________________╱
  ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╲╱░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╱
                                                                  ┃
                                                                /
                                                                ▼

  ? help • q quit
```

The 3D effect comes from:

- The ANSI Shadow wordmark's block-shadow letterforms (`█` faces with `╗` `╝` `╚` `╔` shadow edges)
- Twin angled `╱‾‾‾╲╱‾‾‾╲` top edges suggesting two pages cresting at the spine of an open book
- The bookmark ribbon (`┃` `/` `▼`) dangling from the right page
- Drop shadow `░░░` on the desk surface beneath the book

> **Implementation note.** The verse text inside the book is currently sliced by character index in `welcome-screen.tsx` (33-char windows per page-row), which can break words mid-token (e.g. `"world that H"` / `"e gave..."`). The mockup above shows the intended word-aware layout; promoting the slicer to a word-aware wrapper is a known follow-up.

### `verbum --version` (compact)

When the welcome screen is overkill, just the wordmark plus a one-line tagline:

```
$ verbum --version

██╗   ██╗███████╗██████╗ ██████╗ ██╗   ██╗███╗   ███╗
██║   ██║██╔════╝██╔══██╗██╔══██╗██║   ██║████╗ ████║
██║   ██║█████╗  ██████╔╝██████╔╝██║   ██║██╔████╔██║
╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══██╗██║   ██║██║╚██╔╝██║
 ╚████╔╝ ███████╗██║  ██║██████╔╝╚██████╔╝██║ ╚═╝ ██║
  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝

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
| Verse text | `primary`, normal weight — never decorated |
| Verse number | `muted`, right-aligned in 3-char gutter |
| Focused verse | `▶` `marker` in the gutter + `selection` (inverse) on the line |
| Reference header | `emphasis` (bold), default fg |
| Translation tag | `muted`, in parens |
| Section headers (in palette / lists) | `muted`, slight indent |
| Footnote markers | `emphasis` (bold), superscript-style |
| Keybind hints in status bar | `muted`, separated by `•` |
| Error title (`⚠ ...`) | `emphasis` (bold), default fg — the `⚠` glyph carries the alarm, not a hue |
| Background view behind an open overlay | unchanged — overlay border + position carry the focus, no extra dimming pass |

## What this doc is *not*

- **Not a CSS / theme spec.** Color values get picked when we hook up OpenTUI's theme system. This doc describes *intent*, not hex codes.
- **Not implementation.** The actual component code references this doc but lives in `src/tui/components/`.
- **Not the user manual.** That's the README at ship time.
