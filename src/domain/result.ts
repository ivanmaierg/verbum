// Why: universal fallible-outcome wrapper that never throws — R1, R5.
// Domain functions return this instead of throwing, keeping control flow explicit
// and the Go port mechanical (becomes (T, error) return).
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
