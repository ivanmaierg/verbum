# Exploration: tui-async-effects

## Current State

The TUI consists of one reducer (`src/tui/welcome/welcome-reducer.ts`) with a trivial synchronous `Effect = { kind: "quit" }` union and a driver (`src/tui/tui-driver.tsx`) with a single-case `runEffect()` plain function called synchronously from within a dispatch wrapper. The double-call pattern (reducer called once to extract the effect, then `baseDispatch()` for React state) is already established and documented. There is no `src/infrastructure/` directory — the infrastructure adapter lives in `src/api/`. The TUI driver has zero application-layer calls today.

**BibleRepository dependency chain:**

- Port: `src/application/ports/bible-repository.ts` — `BibleRepository.getChapter(): Promise<Result<Chapter, RepoError>>`
- Use case: `src/application/get-passage.ts` — `getPassage(repo, ref): Promise<Result<Passage, AppError>>`
- Adapter: `src/api/hello-ao-bible-repository.ts` — `createHelloAoBibleRepository(): BibleRepository`
- CLI wires at: `src/cli/run.ts` — `const repo = createHelloAoBibleRepository()`

**Test patterns:** `welcome-reducer.test.ts` is pure sync. `get-passage.test.ts` shows established async pattern: inline stub `BibleRepository` with `getChapter: async () => (...)`, awaited directly. No MSW, no fake timers.

## Affected Areas

- `src/tui/welcome/welcome-reducer.ts` — Effect type extended with two new variants; `quit` branch untouched
- `src/tui/tui-driver.tsx` — `runEffect()` updated to import and delegate to extracted runner; dispatch wrapper unchanged structurally
- `src/tui/runtime/effect-runner.ts` — NEW: `makeEffectRunner(deps)` factory (recommended approach)
- `src/tui/welcome/welcome-reducer.test.ts` — pure sync tests unchanged; thin fixture reducer for `fetch-passage` effect
- `src/tui/runtime/effect-runner.test.ts` — NEW: async tests for happy path, stale-drop, error path
- `src/application/get-passage.ts` — read-only; driver calls it as a dependency
- `src/api/hello-ao-bible-repository.ts` — read-only

## Approaches

### Approach A — Inline async branches in tui-driver.tsx

- Pros: Zero new files, smallest diff
- Cons: Conflates terminal teardown with stale-requestId logic; not reusable for PR 2 reader-reducer; testable only via full App mount
- Effort: Low
- ADR 0009: Compliant but Rule 9 house-rules.md example explicitly names a separate file

### Approach B — Extract `src/tui/runtime/effect-runner.ts` (RECOMMENDED)

```ts
export type EffectDeps = {
  getPassage: (ref: Reference) => Promise<Result<Passage, AppError>>;
  renderer: CliRenderer;
  resolve: () => void;
};

export function makeEffectRunner(deps: EffectDeps) {
  let latestRequestId = 0;
  return function runEffect(effect: Effect, dispatch: Dispatch<WelcomeAction>): void {
    switch (effect.kind) {
      case "quit": {
        deps.renderer.destroy();
        deps.resolve();
        break;
      }
      case "fetch-passage": {
        const { ref, requestId } = effect;
        latestRequestId = requestId;
        deps.getPassage(ref).then((result) => {
          if (requestId !== latestRequestId) return; // stale — drop
          if (result.ok) dispatch({ type: "PassageLoaded", requestId, passage: result.value });
          else dispatch({ type: "FetchFailed", requestId, reason: result.error });
        });
        break;
      }
      case "cancel-fetch": {
        latestRequestId = effect.requestId;
        break;
      }
    }
  };
}
```

- Pros: Single responsibility. Testable in isolation (stub deps, capture dispatched actions). House-rules.md Rule 9 example literally names `src/tui/effect-runner.ts`. Reusable for PR 2/3 by extending Effect union only.
- Cons: One new file + directory
- Effort: Low-Medium
- ADR 0009: Excellent — zero React/OpenTUI imports in runner, injectable deps, no closures in reducer

### Approach C — AbortController per requestId

- Pros: True HTTP-layer cancellation
- Cons: Port interface change (BibleRepository gains AbortSignal param), adapter change, port would need Rule 3 update; intake explicitly forbids AbortController leakage. Out of scope PR 1.
- Effort: High

## Recommendation

**Approach B.** House-rules.md Rule 9 example literally names `src/tui/effect-runner.ts` as the canonical pattern. The `makeEffectRunner(deps)` factory is testable without OpenTUI, makes stale-drop a first-class test case, and sets up PR 2/3 reuse with zero structural change.

**Cancellation semantics:** in-band `cancel-fetch` effect sets `latestRequestId` forward. Any `.then()` callback finding `requestId !== latestRequestId` is silently dropped. No AbortController for PR 1.

## Riskiest Unknown — Verdict

**Low risk.** The double-call pattern is battle-tested. Extending `runEffect` to be async is mechanical — dispatch wrapper already calls `runEffect()` synchronously after `baseDispatch()`; async effects fire-and-forget without blocking React's sync update cycle. The one genuinely new concern (stale-drop path coverage) is addressable with direct Promise control (resolve/reject manually), already the established pattern in `get-passage.test.ts`.

## Rule 8/9 Violation Check — Verdict

No violation. `<App>` has zero `useEffect` calls today. The extension adds no `useEffect`. The `runEffect()` free function is plumbing, not business logic — exactly what Rule 9 permits.

## Open Questions for Proposal Phase

1. **Where does requestId originate?** Option (a): dispatch wrapper uses `useRef<number>` counter (borderline Rule 9 — ref for plumbing only); Option (b): driver stamps a requestId on a "RequestPassage" intent-action before dispatching a "FetchPassageRequested" fact-action. Option (b) is cleaner. Decision needed.

2. **Should Effect be generalized or stay welcome-reducer-specific?** PR 1 can keep it welcome-local (no consumer yet), but proposal must call out the PR 2 boundary for the reader-reducer's Effect union.

3. **Does `tuiDriver()` receive `BibleRepository` as a parameter?** Cleanest: `tuiDriver(repo: BibleRepository)` wired at `src/index.tsx`, mirroring how `run.ts` does it. Proposal must lock this.

4. **Are `PassageLoaded` / `FetchFailed` welcome-reducer actions or reader-reducer actions?** PR 1 needs them only in a test fixture reducer. Proposal must specify location to avoid PR 2 breaking rename.

5. **Does `runEffect` need a generic `Dispatch`?** Welcome-specific for PR 1 is fine, but the runner's type signature should anticipate generalization for PR 2.

## Test Surface for PR 1

Reducer tests (sync): thin "consumer reducer" fixture emits `fetch-passage` on appropriate action; emits `cancel-fetch` on second emission.

Effect-runner tests (async, new):

- Happy path: stub `getPassage` resolves → `PassageLoaded` dispatched
- Stale drop: two `fetch-passage` effects, first resolves after second → first result dropped
- Error path: stub `getPassage` returns `{ ok: false }` → `FetchFailed` dispatched
- Regression: `quit` still calls `renderer.destroy()` + `resolve()`
