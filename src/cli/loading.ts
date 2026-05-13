// src/cli/loading.ts — TTY-aware loading spinner for CLI surfaces.
// Peer of ansi.ts — same env-var precedence chain, separate semantic concern.
// R1/R5: no Result usage; R2: plain functions; R11: HOF, not decorator.

export const SPINNER_FRAMES = [
  "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏",
] as const;

export type SpinnerFrame = (typeof SPINNER_FRAMES)[number];

export type WithLoadingOptions = {
  readonly interval?: number; // ms; default 80
};

// isSpinnerEnabled mirrors isColorEnabled from ansi.ts — deliberate duplication
// for semantic separation (spinner can be disabled independently of color).
export function isSpinnerEnabled(stream: NodeJS.WriteStream): boolean {
  const env = process.env;
  const noColor = env.NO_COLOR;

  // NO_COLOR: any non-empty value disables (https://no-color.org). Empty/unset = no opinion.
  if (typeof noColor === "string" && noColor.length > 0) return false;

  const force = env.FORCE_COLOR;
  if (typeof force === "string" && force.length > 0) {
    // npm convention: "0" and "false" disable; anything else enables.
    const f = force.toLowerCase();
    if (f === "0" || f === "false") return false;
    return true;
  }

  return stream.isTTY === true;
}

// withLoading — wraps an async fn with a Braille spinner on stream (stderr).
// TTY-false path: zero writes, zero overhead, fn result passed through unchanged.
//   This is an UNCONDITIONAL no-op — we never paint a spinner into a pipe,
//   regardless of FORCE_COLOR. Animated cursor returns into a non-TTY would
//   corrupt downstream consumers (logs, captured stdout, CI buffers).
// TTY-true path: still honors isSpinnerEnabled so NO_COLOR / FORCE_COLOR=0 can suppress.
// TTY-true path: initial frame written before interval, cleanup in finally.
// Result<T, E> transparency: never wraps, unwraps, or catches fn's value (R12).
export async function withLoading<T>(
  stream: NodeJS.WriteStream,
  fn: () => Promise<T>,
  options?: WithLoadingOptions,
): Promise<T> {
  if (stream.isTTY !== true) {
    return fn();
  }
  if (!isSpinnerEnabled(stream)) {
    return fn();
  }

  const frameWidth = 1; // All Braille frames are single-column glyphs.
  let i = 0;

  // Write initial frame immediately — guarantees user sees spinner even if fn resolves fast.
  stream.write("\r" + SPINNER_FRAMES[i % SPINNER_FRAMES.length]);
  i++;

  const handle: ReturnType<typeof setInterval> = setInterval(() => {
    stream.write("\r" + SPINNER_FRAMES[i % SPINNER_FRAMES.length]);
    i++;
  }, options?.interval ?? 80);

  try {
    return await fn();
  } finally {
    clearInterval(handle);
    stream.write("\r" + " ".repeat(frameWidth) + "\r");
  }
}
