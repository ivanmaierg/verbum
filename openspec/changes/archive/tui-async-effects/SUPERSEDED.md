# SUPERSEDED — tui-async-effects

- Status: superseded
- Date: 2026-05-11
- Superseded by: [ts-native-architecture](../../ts-native-architecture/)

## What happened

This change was paused mid-exploration when ADR 0009 was superseded by [ADR 0010](../../../docs/decisions/0010-typescript-native-architecture.md).

The `tui-async-effects` exploration was built around the Effect-descriptor pattern (Rule 9 of ADR 0009): the reducer returns an `Effect` descriptor; a `makeEffectRunner` factory executes it. That pattern is retired.

## What replaces it

The async effect problem (fetching a passage from the TUI) is now solved via the TypeScript-native pattern:

- Reducer returns plain `State` (no Effect tuple).
- `useEffect` in the screen component calls the application use case (`getPassage(repo, ref)`).
- Stale-request cancellation uses a `cancelled` flag in the `useEffect` cleanup (or `AbortController` for HTTP-layer cancellation).

See the code sketch in `openspec/changes/ts-native-architecture/explore.md` (Deliverable 3) for a concrete example.

## Engram context

Engram observation #248 contains the tui-async-effects exploration in full. It remains informational for understanding why the Effect-descriptor approach was considered — but its concrete implementation artifacts (`makeEffectRunner`, the `Effect` union extension, the `fetch-passage`/`cancel-fetch` variants) are superseded by the ts-native-architecture pattern.

## Governing change

`openspec/changes/ts-native-architecture/` is the replacement direction.
