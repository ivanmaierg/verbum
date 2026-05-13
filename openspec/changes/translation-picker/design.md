# Design: translation-picker

## Status
design-ready

## Executive Summary
Translation switching is added by lifting `translationId` into `ReaderState` (every chapter-bearing variant), introducing a new `translationPicker` sub-state on the `loaded` variant that models a three-phase overlay (`loading` → `ready` → `error`), and a new `getTranslations()` port + helloao adapter with a session-scoped closure cache. The reducer stays pure: a new `useTranslationsFetch` hook fires when the picker enters `loading`, identical in shape to `usePassageFetch`. The user-facing flow is: press `t` → fetch → filter substring → arrows + Enter → reducer transitions to a fresh `loading` ReaderState with the new `translationId`, which re-runs the existing passage fetch under the chosen translation. The atomic prerequisite is the breaking signature change to `getChapter` / `getPassage` — that ships in the same PR as the picker.

## 1. Data Flow

```
                    KEY 't' pressed
                          │
                          ▼
            (gate: loaded && picker===null)
                          │
                          ▼
        dispatch(TranslationPickerOpened)
                          │
       ┌──────────────────┴──────────────────┐
       │  reducer: loaded.picker = {         │
       │    status: "loading",               │
       │    query: "", selectedIndex: 0,     │
       │    items: [], visibleItems: []      │
       │  }                                  │
       └──────────────────┬──────────────────┘
                          │
                          ▼
       useTranslationsFetch sees status==="loading"
                          │
                          ▼
              repo.getTranslations()
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   dispatch(TranslationsFetched)  dispatch(TranslationsFetchFailed)
            │                           │
            ▼                           ▼
  picker.status="ready"         picker.status="error"
  items=sorted, visibleItems=
    items.slice(0,50)
            │
            ▼
   KEYS routed to picker gate:
     - char/backspace → TranslationPickerQueryTyped
        (recompute visibleItems, reset selectedIndex=0)
     - up/down       → TranslationPickerMovedUp/Down
     - return        → TranslationPickerAccepted
     - escape        → TranslationPickerDismissed
            │
   Accepted:
            ▼
  reducer drops picker AND transitions:
    kind="loading",
    ref=current ref,
    translationId=chosen.id,
    translationName=chosen.name,
    intent="view"
            │
            ▼
   usePassageFetch fires (existing) under new translationId
            │
            ▼
   PassageFetched → loaded → titleFor() now shows new translation name
```

Dismiss (`Esc`) just sets `picker = null` and keeps current state intact.

## 2. State Machine

`ReaderState` gains `translationId: TranslationId` and `translationName: string` on every variant that already carries `ref`:

```ts
type ReaderState =
  | { kind: "awaiting"; /* unchanged — no translation context yet */ ... }
  | { kind: "loading"; ref: Reference; intent: "view" | "pick-verse";
      translationId: TranslationId; translationName: string }
  | { kind: "loaded"; passage: Passage; ref: Reference; cursorIndex: number;
      pageStartIndex: number; versePicker: VersePickerState | null;
      translationId: TranslationId; translationName: string;
      translationPicker: TranslationPickerState | null }
  | { kind: "network-error"; ref: Reference; reason: RepoError;
      translationId: TranslationId; translationName: string };

type TranslationPickerState =
  | { status: "loading"; query: string; items: []; visibleItems: []; selectedIndex: 0 }
  | { status: "ready"; query: string; items: Translation[];
      visibleItems: Translation[]; selectedIndex: number }
  | { status: "error"; reason: RepoError; query: ""; items: []; visibleItems: []; selectedIndex: 0 };
```

Invariants:
- `translationPicker` is non-null ONLY when `kind === "loaded"` AND `versePicker === null` (mutually exclusive overlays).
- `selectedIndex` is always a valid index into `visibleItems` (or 0 when empty).
- `visibleItems.length <= 50`.
- On `query === ""`, `visibleItems = items.slice(0, 50)`.

The initial reducer state stays `awaiting`. The first transition out of `awaiting` (`PassageFetched`-bound loading) populates `translationId = DEFAULT_TRANSLATION_ID` and `translationName = "Berean Standard Bible"` until the user picks something else. Since `awaiting` has no translation context, the initial pipeline injects defaults at the first `loading` transition — handled in every reducer handler that constructs a `loading` state (centralised via a `withTranslation(state, ref, intent)` helper to avoid duplication).

## 3. Action Set

Seven new `ReaderAction` variants:

```ts
| { type: "TranslationPickerOpened" }
| { type: "TranslationsFetched"; translations: Translation[] }
| { type: "TranslationsFetchFailed"; reason: RepoError }
| { type: "TranslationPickerQueryTyped"; query: string }
| { type: "TranslationPickerMovedUp" }
| { type: "TranslationPickerMovedDown" }
| { type: "TranslationPickerAccepted" }
| { type: "TranslationPickerDismissed" }
```

Reducer guards:
- `TranslationPickerOpened` no-ops unless `kind === "loaded" && versePicker === null && translationPicker === null`.
- `TranslationsFetched/FetchFailed` no-op unless `kind === "loaded" && translationPicker?.status === "loading"`.
- `TranslationPickerQueryTyped/MovedUp/MovedDown` no-op unless `translationPicker?.status === "ready"`.
- `TranslationPickerAccepted` no-op unless `status === "ready" && visibleItems.length > 0`. It synthesises a fresh `loading` state: `{ kind: "loading", ref: s.ref, intent: "view", translationId: chosen.id, translationName: chosen.name }`.
- `TranslationPickerDismissed` clears `translationPicker` to `null`; works in any picker status (including error).

## 4. Port Shape

```ts
// src/domain/translation.ts
export type Translation = {
  id: TranslationId;
  name: string;
  language: string;            // raw helloao "language" (e.g. "eng")
  languageEnglishName: string; // helloao "languageEnglishName" (e.g. "English")
};

// src/application/ports/bible-repository.ts (added method)
interface BibleRepository {
  getChapter(...): Promise<Result<Chapter, RepoError>>;
  getTranslations(): Promise<Result<Translation[], RepoError>>;
}
```

Adapter (`src/api/hello-ao-bible-repository.ts`):

```ts
const ENDPOINT = "https://bible.helloao.org/api/available_translations.json";

export function createHelloAoBibleRepository(): BibleRepository {
  let cached: Translation[] | null = null;   // session cache (ADR-2)

  return {
    async getChapter(...) { /* unchanged */ },

    async getTranslations() {
      if (cached !== null) return { ok: true, value: cached };
      try {
        const res = await fetch(ENDPOINT);
        if (!res.ok) return { ok: false, error: { kind: "network", message: `HTTP ${res.status}` } };
        const json = await res.json();
        const parsed = RawTranslationsResponseSchema.safeParse(json);
        if (!parsed.success) return { ok: false, error: { kind: "schema_mismatch", details: parsed.error.message } };
        const list = parsed.data.translations.map(toTranslation);
        list.sort((a, b) =>
          a.languageEnglishName.localeCompare(b.languageEnglishName) ||
          a.name.localeCompare(b.name)
        );
        cached = list;
        return { ok: true, value: list };
      } catch (err) {
        return { ok: false, error: { kind: "network", message: String(err) } };
      }
    },
  };
}
```

Sort order: `languageEnglishName` ASC, then `name` ASC (locale-aware). This stable order is what the picker shows on empty query.

Schemas in `src/api/schemas.ts`:

```ts
export const RawTranslationSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  languageEnglishName: z.string(),
}).passthrough();   // textDirection, shortName etc. are tolerated but unused.

export const RawTranslationsResponseSchema = z.object({
  translations: z.array(RawTranslationSchema),
}).passthrough();
```

## 5. Use-Case Signature Break (atomic — same PR)

**Before:**

```ts
// get-chapter.ts
export async function getChapter(repo, ref): Promise<Result<Passage, AppError>> {
  const r = await repo.getChapter(DEFAULT_TRANSLATION_ID, ref.book, ref.chapter);
  ...
}
// get-passage.ts — same shape
```

**After:**

```ts
export async function getChapter(
  repo: BibleRepository,
  translationId: TranslationId,
  ref: Reference,
): Promise<Result<Passage, AppError>> {
  const r = await repo.getChapter(translationId, ref.book, ref.chapter);
  ...
}
// get-passage.ts — same change: prepend translationId parameter.
```

`DEFAULT_TRANSLATION_ID` is no longer imported by either use case — the import moves to the call sites (CLI uses it; TUI passes `state.translationId`).

Call sites to update in this PR (atomic):
- `src/cli/run.ts` — pass `DEFAULT_TRANSLATION_ID` (CLI never picks; keep existing UX).
- `src/cli/vod.ts` — same.
- `src/tui/reader/use-passage-fetch.ts` — pass `state.translationId` from the `loading` state (already in state shape after this change).
- Their tests: any unit test that calls `getChapter(repo, ref)` or `getPassage(repo, ref)` gains the translationId argument. Use `DEFAULT_TRANSLATION_ID` as the value to keep test intent unchanged.

This is a hard, mechanical, breadth-1 change. It ships in the same PR as the picker because leaving the old signature behind a feature flag would double the maintenance surface during the slice.

## 6. Indicator Rendering

Replace `reader-screen.tsx` line 61:

```ts
// BEFORE
return ` ${state.ref.book} ${state.ref.chapter} — Berean Standard Bible `;
// AFTER
return ` ${state.ref.book} ${state.ref.chapter} — ${state.translationName} `;
```

`titleFor()` `awaiting` branch stays as `" verbum "` for v1 — there is no `translationName` in scope and the welcome→awaiting flow does not yet know what translation will be used. Decision: keep `awaiting` as-is. Adding a "default translation hint" subtitle is a v2 polish item, not scoped here.

## 7. Fetch Trigger

New hook, sibling of `usePassageFetch`:

```ts
// src/tui/reader/use-translations-fetch.ts
export function useTranslationsFetch(state: ReaderState, dispatch, repo): void {
  useEffect(() => {
    if (state.kind !== "loaded") return;
    if (state.translationPicker?.status !== "loading") return;

    let cancelled = false;
    repo.getTranslations().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: "TranslationsFetched", translations: result.value });
      } else {
        dispatch({ type: "TranslationsFetchFailed", reason: result.error });
      }
    });
    return () => { cancelled = true; };
  }, [state.kind, state.kind === "loaded" ? state.translationPicker?.status : null]);
}
```

`ReaderScreen` calls both hooks — `usePassageFetch(...)` and `useTranslationsFetch(...)` — at the top of the component. No new async infrastructure; identical cancellation pattern.

## 8. Key Routing

`tui-driver.tsx` adds a new gate ABOVE the verse-picker gate (since picker is more modal):

```ts
// New gate — translation picker is open
if (readerState.kind === "loaded" && readerState.translationPicker !== null) {
  const picker = readerState.translationPicker;
  if (name === "escape") { dispatch({ type: "TranslationPickerDismissed" }); return; }
  if (picker.status !== "ready") return;       // ignore keys during loading/error
  if (name === "up")     { dispatch({ type: "TranslationPickerMovedUp" }); return; }
  if (name === "down")   { dispatch({ type: "TranslationPickerMovedDown" }); return; }
  if (name === "return") { dispatch({ type: "TranslationPickerAccepted" }); return; }
  // Char/backspace are handled by an <input> element inside the overlay
  // — same pattern as the search query in `awaiting`. No driver routing for chars.
  return;
}
```

`t` shortcut — added to the existing "reader, no overlay" branch (after the verse-picker gate, alongside `n`/`p`/`/`):

```ts
if (name === "t") { dispatch({ type: "TranslationPickerOpened" }); return; }
```

Gate ordering (top to bottom): quit → welcome → awaiting → verse-picker → **translation-picker** → reader nav. Two overlays cannot be active at once (enforced by reducer invariants and by the fact that `t` is only dispatched from the "no overlay" branch).

`q` quit stays absolute (highest precedence) — closes app from anywhere, including from within the picker. This matches today's behaviour for verse picker.

## 9. Filter Algorithm

```
function recomputeVisible(items: Translation[], query: string): Translation[] {
  const q = query.trim().toLowerCase();
  if (q === "") return items.slice(0, 50);          // empty → first 50 of sorted list
  const out: Translation[] = [];
  for (const t of items) {
    const hay = (t.name + " " + t.languageEnglishName).toLowerCase();
    if (hay.includes(q)) {
      out.push(t);
      if (out.length >= 50) break;                  // cap during scan, not after
    }
  }
  return out;
}
```

Applied inside the reducer for both `TranslationPickerQueryTyped` and `TranslationsFetched`. After recompute, `selectedIndex = 0` is forced — the cursor parks on the top match (fzf-style).

The view receives `visibleItems` directly and renders them. The screen NEVER sees the full 1000-item list. Cap is enforced in the reducer (single source of truth) so the screen has no slicing logic.

## 10. Testing Strategy

**Reducer (`src/tui/reader/reader-reducer.test.ts`):** add pure-function tests following the existing convention — call `readerReducer(state, action)` and assert the next state. Coverage:
- `TranslationPickerOpened` from `loaded` (versePicker null) yields picker with `status: "loading"`.
- `TranslationPickerOpened` is a no-op when versePicker is non-null.
- `TranslationsFetched` populates items, sorts already done by adapter so don't re-test here, computes visibleItems.slice(0, 50).
- `TranslationPickerQueryTyped` recomputes visibleItems and resets selectedIndex.
- `TranslationPickerMovedUp/Down` clamp at bounds.
- `TranslationPickerAccepted` transitions to `loading` with the chosen translationId/name and current ref.
- `TranslationPickerDismissed` clears the picker without changing translationId.

**Adapter (`src/api/hello-ao-bible-repository.test.ts`):** mirror the existing fetch-stub pattern. Stub `fetch` to return a JSON payload with two translations in reverse alphabetical order; assert (a) sort applied, (b) two consecutive calls hit the network only once (cache), (c) HTTP 500 → `network` error, (d) malformed JSON → `schema_mismatch`.

**Screen (`src/tui/reader/reader-screen.test.tsx`):** follow the smoke-test shape. Render with a `loaded` state where `translationName: "King James Version"` and assert the title contains it. Render with picker `ready` containing two visible items and assert both render with a cursor marker on index 0.

No new test infra; no e2e changes (the welcome→reader smoke test stays the same since `t` is only meaningful from `loaded`).

## ADRs

### ADR-1: Shortcut is bare `t`, not `Ctrl+T`

- **Decision**: bind `t` (unmodified).
- **Why**: `t` is unbound in normal reading mode. Existing key handler in `tui-driver.tsx` reads `keyEvent.name.toLowerCase()` without inspecting modifiers — staying within that pattern means zero new keyboard infrastructure. Single-letter shortcuts also match the existing palette UX (`n`, `p`, `/`, `[`, `]`).
- **Rejected**: `Ctrl+T`. OpenTUI modifier surface is not currently used anywhere in this codebase; adopting it for one shortcut risks subtle cross-platform inconsistency (e.g. terminal multiplexer interception of Ctrl combinations). The cost of single-key collision in the future is low — the picker will never open while typing into an `<input>` (overlays absorb keys, awaiting state captures `t` via the input element).

### ADR-2: Session-scoped closure cache, not disk or none

- **Decision**: `let cached: Translation[] | null = null` inside the adapter factory.
- **Why**: One fetch per process run. 1000+ items is ~120 KB of JSON over a single GET; refetching every time the user opens the picker is wasteful and adds visible latency. The session boundary is the natural staleness fence — translations don't change within minutes.
- **Rejected — disk cache**: Adds file I/O, schema versioning, and TTL logic for a v1 surface that doesn't justify it. Defer to a future `verbum-translation-cache` slice if cold-start latency becomes a complaint.
- **Rejected — no cache**: Re-fetch on every `t` press hits the network every time. Slow over weak connections; the picker would flash a "loading…" state unnecessarily.

### ADR-3: Slice cap 50, not virtualization

- **Decision**: reducer caps `visibleItems` at 50.
- **Why**: OpenTUI renders to a fixed terminal. A typical terminal shows ~30 rows; 50 already overflows the visible area but provides headroom for scrolling. Substring filter on the first match for a typical query (`"kjv"`, `"spanish"`) returns far fewer than 50 items anyway. The cap exists to bound the empty-query render cost (1000 `<text>` nodes is unacceptably slow in OpenTUI).
- **Rejected — virtualization**: OpenTUI has no first-class windowing primitive. Implementing one for a single screen would dominate the change. A hard cap with sorted defaults is good enough; users who can't find a translation in 50 sorted entries should type two more characters.

### ADR-4: Substring match, not fzf-style scoring

- **Decision**: `name + " " + languageEnglishName` → lowercased → `.includes(q)`.
- **Why**: Trivial to implement, zero dependencies, predictable. Translations have well-known names ("King James Version", "Reina Valera") — substring is more than enough discrimination.
- **Rejected — fzf**: The codebase already has `book-suggestions.ts` with token scoring, but applying it to 1000 items isn't free and the gain is marginal for translation names. Future `verbum-fuzzy-ranker` slice can lift this with a single function swap.

## Data-flow consequences for existing code

- `usePassageFetch` must read `state.translationId` from the `loading` state and pass it through `getChapter(repo, translationId, ref)`. Its deps array gains `state.kind === "loading" ? state.translationId : null` so a translation switch (same ref, new translationId) refires the effect.
- Reducer handlers that construct `loading` states (`QuerySubmitted`, `SuggestionAccepted`, `ChapterChosen`, `ChapterAdvanced`, `ChapterRetreated`, `PaletteReopened`-returning, `TranslationPickerAccepted`) must populate `translationId` and `translationName`. For transitions FROM `loaded` / `network-error`, copy from the previous state. For transitions FROM `awaiting`, use `DEFAULT_TRANSLATION_ID` and the literal name `"Berean Standard Bible"` (still the v1 default until the user picks otherwise).
- A small helper `withTranslation(prev: ReaderState): { translationId; translationName }` centralises this projection so no handler hard-codes the default in more than one place.

## Risks

- **`awaiting`→`loading` default name drift**: The literal `"Berean Standard Bible"` lives both in `DEFAULT_TRANSLATION_ID` and as a string. If helloao renames BSB, the title is wrong until the user picks. Acceptable for v1 — surface via a TODO comment near the constant.
- **Sort stability under locale**: `localeCompare` without explicit locale may differ across Node versions. Risk is cosmetic (display order). Pin to `"en"` if it becomes flaky.
- **Reducer fan-out**: Threading `translationId` through every chapter-bearing variant touches many handlers. The `withTranslation` helper reduces duplication, but the diff is wide — review carefully and lean on type errors (TS will catch missed fields).

## Artifacts
- openspec/changes/translation-picker/design.md
- engram topic_key: sdd/translation-picker/design

## Next Recommended
sdd-tasks
