# Spec: translation-picker

## Capability

TUI + domain — translation picker overlay with persistent translation indicator.

Extends `ReaderState` to hold `translationId` and `translationName` as first-class state. Adds a `getTranslations` port to `BibleRepository`, an HTTP adapter implementation with session-scoped cache, and a modal picker overlay triggered by the `t` key. The reader header always reflects the active translation name. `getChapter`/`getPassage` use cases accept `translationId` as an explicit parameter instead of importing the default constant.

---

## Requirements

### Domain — `Translation` type

**REQ-01** `src/domain/translations.ts` SHALL export a `Translation` interface with exactly these fields:

```ts
export interface Translation {
  id: TranslationId;
  name: string;
  language: string;
  languageEnglishName: string;
  textDirection: "ltr" | "rtl";
}
```

`TranslationId` is the existing branded type (or a new one if not yet present). The file is the sole definition of `Translation` in the codebase.

**REQ-02** `src/domain/translations.ts` SHALL re-export (or co-locate) `TranslationId` so that downstream modules can import both `Translation` and `TranslationId` from the same path.

---

### Port — `BibleRepository.getTranslations`

**REQ-03** The `BibleRepository` port (declared in `src/domain/bible-repository.ts` or equivalent) SHALL include:

```ts
getTranslations(): Promise<Result<Translation[], RepoError>>;
```

No parameters. The return type uses the existing `Result<T, E>` and `RepoError` types already present in the codebase.

**REQ-04** No existing method signature on `BibleRepository` is changed as part of REQ-03. The addition is purely additive.

---

### Port — `getChapter` / `getPassage` signature

**REQ-05** The `getChapter` use case SHALL accept `translationId: TranslationId` as an explicit parameter. It SHALL NOT import `DEFAULT_TRANSLATION_ID` from any module.

**REQ-06** The `getPassage` use case SHALL accept `translationId: TranslationId` as an explicit parameter. It SHALL NOT import `DEFAULT_TRANSLATION_ID` from any module.

**REQ-07** All call sites that invoke `getChapter` or `getPassage` SHALL pass `translationId` explicitly. The CLI entry points (`src/cli/run.ts`, `src/cli/vod.ts`) pass `DEFAULT_TRANSLATION_ID`. The TUI entry point (`src/tui/reader/use-passage-fetch.ts` or equivalent) passes `state.translationId`.

---

### Adapter — `getTranslations` implementation

**REQ-08** `createHelloAoBibleRepository` (in `src/infrastructure/hello-ao-bible-repository.ts` or equivalent) SHALL implement `getTranslations`. On first call it fetches `https://api.helloao.org/api/available_translations.json` (or the equivalent helloao endpoint), maps the response to `Translation[]`, stores the result in a closure-scoped variable (`let cached: Translation[] | null = null`), and returns `{ ok: true, value: translations }`.

**REQ-09** On subsequent calls within the same process, `getTranslations` SHALL return the cached `Translation[]` without issuing a network request.

**REQ-10** If the HTTP request fails or the response cannot be parsed, `getTranslations` SHALL return `{ ok: false, error: <RepoError> }`. The cached variable MUST NOT be populated on error.

---

### State — `translationId` and `translationName` on `ReaderState`

**REQ-11** The `loading`, `loaded`, and `network-error` variants of `ReaderState` SHALL each include:

```ts
translationId: TranslationId;
translationName: string;
```

The `awaiting` variant SHALL NOT include these fields (it has no translation context yet).

**REQ-12** The initial `ReaderState` produced by the factory (e.g., `makeLoadingState` or equivalent) SHALL set `translationId` to `DEFAULT_TRANSLATION_ID` and `translationName` to `"Berean Standard Bible"`.

**REQ-13** Every reducer transition that produces a `loading`, `loaded`, or `network-error` state SHALL propagate `translationId` and `translationName` from the incoming state, EXCEPT when REQ-24 (accept behavior) explicitly replaces them.

---

### State — `translationPicker` sub-state

**REQ-14** The `loaded` variant of `ReaderState` SHALL include:

```ts
translationPicker: {
  status: "loading" | "ready" | "error";
  query: string;
  items: Translation[];
  visibleItems: Translation[];
  selectedIndex: number;
} | null;
```

`translationPicker` is `null` when the picker overlay is not active.

**REQ-15** When `translationPicker` is non-null, all reader key events EXCEPT the picker's own navigation keys SHALL be suppressed in the driver. The permitted keys are defined in REQ-27.

---

### New Actions

**REQ-16** `TranslationPickerOpened` is a valid action type with no payload. It is only meaningful when the current state is `loaded` with `translationPicker === null`.

**REQ-17** `TranslationsFetched` is a valid action type with payload `{ translations: Translation[] }`.

**REQ-18** `TranslationFetchFailed` is a valid action type with no payload.

**REQ-19** `TranslationPickerQueryTyped` is a valid action type with payload `{ query: string }`.

**REQ-20** `TranslationPickerMovedUp` is a valid action type with no payload.

**REQ-21** `TranslationPickerMovedDown` is a valid action type with no payload.

**REQ-22** `TranslationPickerAccepted` is a valid action type with no payload.

**REQ-23** `TranslationPickerDismissed` is a valid action type with no payload.

---

### Reducer transitions — `TranslationPickerOpened`

**REQ-24-a** When `TranslationPickerOpened` fires in `loaded` state with `translationPicker === null`, the reducer transitions to `loaded` with `translationPicker` set to:

```ts
{ status: "loading", query: "", items: [], visibleItems: [], selectedIndex: 0 }
```

All other `loaded` fields are unchanged.

**REQ-24-b** `TranslationPickerOpened` when `translationPicker !== null` or when state is not `loaded` returns the state unchanged.

---

### Reducer transitions — `TranslationsFetched`

**REQ-25-a** When `TranslationsFetched` fires in `loaded` state with `translationPicker.status === "loading"`, the reducer sets:

- `translationPicker.status` to `"ready"`
- `translationPicker.items` to the payload's `translations`
- `translationPicker.visibleItems` to the first 50 items of `translations` sorted by `language` then `name` (empty query path)
- `translationPicker.selectedIndex` to `0`
- `translationPicker.query` unchanged (still `""`)

**REQ-25-b** `TranslationsFetched` when `translationPicker` is `null` or `status !== "loading"` returns the state unchanged.

---

### Reducer transitions — `TranslationFetchFailed`

**REQ-26-a** When `TranslationFetchFailed` fires in `loaded` state with `translationPicker.status === "loading"`, the reducer sets `translationPicker.status` to `"error"`. All other `translationPicker` fields are unchanged.

**REQ-26-b** `TranslationFetchFailed` when `translationPicker` is `null` or `status !== "loading"` returns the state unchanged.

---

### Reducer transitions — `TranslationPickerQueryTyped`

**REQ-27-a** When `TranslationPickerQueryTyped` fires in `loaded` state with `translationPicker.status === "ready"`, the reducer:

1. Sets `translationPicker.query` to the payload's `query`.
2. Recomputes `translationPicker.visibleItems`:
   - If `query` is empty: first 50 of `items` sorted by `language` then `name`.
   - If `query` is non-empty: `items.filter(t => \`${t.name} ${t.language}\`.toLowerCase().includes(query.toLowerCase()))` then `.slice(0, 50)`.
3. Resets `translationPicker.selectedIndex` to `0`.

**REQ-27-b** `TranslationPickerQueryTyped` when `translationPicker` is `null` or `status !== "ready"` returns the state unchanged.

---

### Reducer transitions — `TranslationPickerMovedUp` / `TranslationPickerMovedDown`

**REQ-28** `TranslationPickerMovedUp` in `loaded` state with `translationPicker.status === "ready"` decrements `translationPicker.selectedIndex` by 1, clamped to `0` (minimum).

**REQ-29** `TranslationPickerMovedDown` in `loaded` state with `translationPicker.status === "ready"` increments `translationPicker.selectedIndex` by 1, clamped to `visibleItems.length - 1` (maximum). When `visibleItems` is empty the index remains `0`.

**REQ-30** `TranslationPickerMovedUp` and `TranslationPickerMovedDown` when `translationPicker` is `null` or `status !== "ready"` return the state unchanged.

---

### Reducer transitions — `TranslationPickerAccepted`

**REQ-31** When `TranslationPickerAccepted` fires in `loaded` state with `translationPicker.status === "ready"` and `visibleItems.length > 0`, the reducer transitions to `loading` with:

- `ref` copied from the current `loaded.ref`
- `translationId` set to `visibleItems[selectedIndex].id`
- `translationName` set to `visibleItems[selectedIndex].name`

The `translationPicker` sub-state is dropped (state kind changes to `loading`).

**REQ-32** `TranslationPickerAccepted` when `translationPicker` is `null`, `status !== "ready"`, or `visibleItems.length === 0` returns the state unchanged.

---

### Reducer transitions — `TranslationPickerDismissed`

**REQ-33** `TranslationPickerDismissed` in `loaded` state with `translationPicker !== null` sets `translationPicker` to `null`. All other `loaded` fields are unchanged.

**REQ-34** `TranslationPickerDismissed` when `translationPicker === null` or when state is not `loaded` returns the state unchanged.

---

### Driver — key event routing

**REQ-35** In `tui-driver.tsx`, when `readerState.kind === "loaded"` and `readerState.translationPicker !== null`, the driver intercepts the following keys before any other `loaded`-state handler:

| Key | `translationPicker.status` | Action dispatched |
|-----|---------------------------|-------------------|
| `"up"` | `"ready"` | `TranslationPickerMovedUp` |
| `"down"` | `"ready"` | `TranslationPickerMovedDown` |
| `"return"` | `"ready"` | `TranslationPickerAccepted` |
| `"escape"` | any | `TranslationPickerDismissed` |

After dispatching, the handler returns immediately.

**REQ-36** When `readerState.kind === "loaded"` and `readerState.translationPicker !== null`, all key events NOT listed in REQ-35 (including `[`, `]`, `n`, `p`, `/`, `t`) are suppressed — the driver returns without dispatching. Printable characters are forwarded to `TranslationPickerQueryTyped` with the full current query string updated with the typed character (append) or Backspace (delete last character).

**REQ-37** When `readerState.kind === "loaded"` and `readerState.translationPicker === null`, the bare `t` key dispatches `TranslationPickerOpened`.

---

### Side-effect — `getTranslations` trigger

**REQ-38** When the driver dispatches `TranslationPickerOpened`, it also initiates an async call to `repository.getTranslations()`. On resolution it dispatches `TranslationsFetched` or `TranslationFetchFailed` according to the result. This side-effect is initiated in the driver (not the reducer).

---

### View — translation picker overlay

**REQ-39** When `readerState.kind === "loaded"` and `readerState.translationPicker !== null`, the reader screen renders the picker overlay. The reading view beneath it SHOULD be rendered (dim if OpenTUI supports it; absence of dim is acceptable per current OpenTUI constraints).

**REQ-40** The picker overlay, when `status === "loading"`, renders a single-line loading indicator (text content unspecified; a loading message is sufficient).

**REQ-41** The picker overlay, when `status === "ready"`, renders:

1. A text input showing `translationPicker.query`.
2. A list of `visibleItems`, each as a single line showing `name` and `language`. The item at `selectedIndex` is highlighted with `fg={ACCENT_HEX}` and a `▶` prefix.
3. A bottom title indicating navigation keys (`↑↓` to move, `Enter` to select, `Esc` to dismiss).

**REQ-42** The picker overlay, when `status === "error"`, renders a single-line error message. The `Esc` key dismisses the overlay (via REQ-35). No retry mechanism is provided in v1.

---

### View — persistent translation indicator in reader header

**REQ-43** `titleFor` (or the equivalent header-string helper in `reader-screen.tsx`) SHALL read `translationName` from `ReaderState` for the `loaded` variant. The literal string `"Berean Standard Bible"` SHALL NOT appear in `reader-screen.tsx`.

**REQ-44** `titleFor` for `loading` and `network-error` states SHALL also include `translationName` if a meaningful value is available in state, propagating the same string used before the transition.

---

### Non-functional

**REQ-45** No new runtime dependencies are introduced in `package.json`. The HTTP fetch uses the existing platform fetch (Bun built-in).

**REQ-46** TypeScript compilation passes cleanly (`tsc --noEmit`) with no new type errors.

**REQ-47** All new reducer action handlers use the object-dispatch (`satisfies`) pattern consistent with ADR 0010. No `switch` statements are added in new code.

**REQ-48** No comments that merely restate the code are added. Comments are permitted only for non-obvious intent, constraints, or external references.

**REQ-49** Test count grows from 208 to approximately 250 or more: mechanical updates account for state shape changes (`translationId`/`translationName` fields in snapshots), and new tests cover all new reducer transitions, the `getTranslations` adapter (unit, with fetch mock), and the `titleFor` header helper.

---

## Acceptance Scenarios

### SCENARIO-01: Translation domain type is well-formed

- Given `src/domain/translations.ts` is imported
- When `Translation` is used as a type annotation with `{ id: "BSB", name: "Berean Standard Bible", language: "English", languageEnglishName: "English", textDirection: "ltr" }`
- Then the TypeScript compiler accepts the value without type errors

---

### SCENARIO-02: `getTranslations` port is callable on BibleRepository

- Given a test-double that implements `BibleRepository`
- When it includes a `getTranslations(): Promise<Result<Translation[], RepoError>>` method
- Then the TypeScript compiler accepts the double as satisfying the `BibleRepository` interface

---

### SCENARIO-03: `getChapter` no longer imports DEFAULT_TRANSLATION_ID

- Given `src/application/get-chapter.ts` is inspected
- When the file contents are searched for `DEFAULT_TRANSLATION_ID` imports
- Then no such import is found
- And the function signature includes `translationId: TranslationId` as a parameter

---

### SCENARIO-04: CLI entry points pass DEFAULT_TRANSLATION_ID explicitly

- Given `src/cli/run.ts` is inspected
- When the call to `getPassage` (or `getChapter`) is found
- Then it includes `DEFAULT_TRANSLATION_ID` as an explicit argument
- And the same is true in `src/cli/vod.ts`

---

### SCENARIO-05: Adapter caches translations after first fetch

- Given `createHelloAoBibleRepository` is instantiated
- And global `fetch` is mocked to return a valid translations payload once
- When `getTranslations()` is called twice on the same repository instance
- Then `fetch` is called exactly once
- And both calls return the same `Translation[]` array

---

### SCENARIO-06: Adapter returns error result on network failure

- Given `createHelloAoBibleRepository` is instantiated
- And global `fetch` is mocked to reject with a network error
- When `getTranslations()` is called
- Then the returned result is `{ ok: false, error: <RepoError> }`
- And calling `getTranslations()` a second time issues another fetch (cache was not poisoned)

---

### SCENARIO-07: Initial ReaderState has DEFAULT_TRANSLATION_ID and "Berean Standard Bible"

- Given a fresh TUI session starts
- When the initial reader state is inspected
- Then `state.translationId` equals `DEFAULT_TRANSLATION_ID`
- And `state.translationName` equals `"Berean Standard Bible"`

---

### SCENARIO-08: `t` key opens picker in loaded state

- Given `readerState.kind === "loaded"` and `translationPicker === null`
- When the user presses `t`
- Then `TranslationPickerOpened` is dispatched
- And `readerState.translationPicker` becomes `{ status: "loading", query: "", items: [], visibleItems: [], selectedIndex: 0 }`
- And `getTranslations()` is called on the repository

---

### SCENARIO-09: `t` key is suppressed when picker is already open

- Given `readerState.kind === "loaded"` and `translationPicker !== null`
- When the user presses `t`
- Then no action is dispatched

---

### SCENARIO-10: `TranslationsFetched` populates visibleItems (empty query)

- Given `readerState.kind === "loaded"` and `translationPicker.status === "loading"`
- When `TranslationsFetched` fires with a payload of 120 translations
- Then `translationPicker.status` becomes `"ready"`
- And `translationPicker.items.length` equals `120`
- And `translationPicker.visibleItems.length` equals `50`
- And `translationPicker.visibleItems` represents the first 50 items sorted by `language` then `name`
- And `translationPicker.selectedIndex` equals `0`

---

### SCENARIO-11: Typing filters visibleItems

- Given `translationPicker.status === "ready"` and `items` contains 120 translations including several with "kjv" in name or language
- When `TranslationPickerQueryTyped` fires with `{ query: "kjv" }`
- Then `translationPicker.visibleItems` contains only translations whose `name + " " + language` includes "kjv" (case-insensitive)
- And `translationPicker.selectedIndex` resets to `0`

---

### SCENARIO-12: visibleItems capped at 50 even when filter matches more

- Given `items` contains 200 translations all with "Bible" in name
- When `TranslationPickerQueryTyped` fires with `{ query: "bible" }`
- Then `translationPicker.visibleItems.length` equals `50`

---

### SCENARIO-13: Arrow navigation within visibleItems

- Given `translationPicker.status === "ready"` and `visibleItems.length === 10` and `selectedIndex === 5`
- When `TranslationPickerMovedDown` fires
- Then `selectedIndex` becomes `6`

- Given `selectedIndex === 0`
- When `TranslationPickerMovedUp` fires
- Then `selectedIndex` remains `0` (clamped)

- Given `selectedIndex === 9` (last)
- When `TranslationPickerMovedDown` fires
- Then `selectedIndex` remains `9` (clamped)

---

### SCENARIO-14: `Esc` dismisses picker without changing translation

- Given `readerState.kind === "loaded"` and `translationPicker !== null`
- And `translationId === "BSB"` and `translationName === "Berean Standard Bible"`
- When the user presses `Esc`
- Then `TranslationPickerDismissed` is dispatched
- And `translationPicker` becomes `null`
- And `translationId` and `translationName` are unchanged

---

### SCENARIO-15: `Enter` accepts selected translation and triggers re-fetch

- Given `translationPicker.status === "ready"` and `visibleItems[2].id === "KJV"` and `visibleItems[2].name === "King James Version"` and `selectedIndex === 2`
- When the user presses `Enter`
- Then `TranslationPickerAccepted` is dispatched
- And the state transitions to `loading` with `translationId === "KJV"` and `translationName === "King James Version"`
- And `ref` is the same ref as the previously loaded passage

---

### SCENARIO-16: Reader header reflects translationName

- Given `readerState.kind === "loaded"` and `translationName === "King James Version"`
- When `titleFor(readerState)` is called
- Then the returned string includes `"King James Version"`
- And the literal `"Berean Standard Bible"` does NOT appear anywhere in `reader-screen.tsx`

---

### SCENARIO-17: `TranslationFetchFailed` sets error status

- Given `translationPicker.status === "loading"`
- When `TranslationFetchFailed` fires
- Then `translationPicker.status` becomes `"error"`
- And all other `translationPicker` fields are unchanged

---

### SCENARIO-18: Error overlay renders and Esc dismisses it

- Given `translationPicker.status === "error"`
- When the screen renders
- Then a one-line error message is visible in the overlay
- When the user presses `Esc`
- Then `TranslationPickerDismissed` is dispatched and the overlay is dismissed

---

### SCENARIO-19: Non-picker keys suppressed while picker is open

- Given `readerState.kind === "loaded"` and `translationPicker !== null`
- When the user presses `[` (previous chapter key)
- Then no action is dispatched and the state is unchanged

---

### SCENARIO-20: End-to-end happy path — KJV switch

- Given a running TUI with John 3 loaded under BSB (`translationId = "BSB"`, header shows `"Berean Standard Bible"`)
- When the user presses `t`
- Then the picker overlay opens in loading state
- When `getTranslations()` resolves successfully
- Then the overlay switches to ready state with 50 visible items
- When the user types `"kjv"`
- Then visibleItems narrows to KJV-matching translations
- When the user presses `Enter` with KJV selected
- Then state transitions to loading for John 3 under KJV
- When the passage fetch resolves
- Then the header reads `"John 3 — King James Version"`
- And `translationId === "KJV"` in state

---

### SCENARIO-21: TUI pass-through — translation ID threaded through use-passage-fetch

- Given `use-passage-fetch.ts` (or equivalent TUI effect hook)
- When it calls `getChapter` (or `getPassage`)
- Then it passes `state.translationId` as the explicit `translationId` argument
- And no reference to `DEFAULT_TRANSLATION_ID` exists in that file

---

## Non-goals (v1)

| Item | Reason |
|------|--------|
| Favorites section | Requires a preferences/persistence layer not yet present |
| Cross-run persistence | Separate slice (`verbum-translation-persistence`) |
| RTL rendering | `textDirection` field captured in type; rendering deferred to v2 |
| Fuzzy / ranked scoring | Substring filter is sufficient for v1; fzf-grade scoring is a separate change |
| Disk cache for translations list | Session-scoped in-memory cache is sufficient in v1 |
| Picker as first-run screen | Out of scope; picker is always secondary to reader |
| Retry on fetch error | No retry in v1; `Esc` and re-opening is the escape hatch |

---

## Spec-Level Risks

| Risk | Status |
|------|--------|
| `getChapter`/`getPassage` signature break | Mechanical blast across `run.ts`, `vod.ts`, `use-passage-fetch.ts`, and related tests; wide but routine |
| `translationId`/`translationName` added to three state variants | ~N snapshot sites in reducer tests; all mechanical |
| helloao `/api/available_translations.json` schema may differ from assumed shape | Explore artifact confirms endpoint and shape; adapter must guard malformed entries |
| OpenTUI query input handling (printable key forwarding) | Driver must synthesize `TranslationPickerQueryTyped` from raw key events; existing `QueryTyped` pattern in palette is direct precedent |
| visibleItems sort stability | JS `.sort()` is stable in V8/Bun; no extra guard needed |
