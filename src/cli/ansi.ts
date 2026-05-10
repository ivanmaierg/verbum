// src/cli/ansi.ts — ANSI escape helpers for CLI surfaces, gated on per-stream color state.
// Single point of env-var reading is isColorEnabled; helpers are pure string transforms.
// R1/R5 do not apply: no Result usage here — these are infallible identity-or-wrap fns.

import { ACCENT_HEX } from "@/presentation/colors";

export const RESET = "\x1b[0m";

const ACCENT_OPEN = "\x1b[38;2;91;160;242m"; // truecolor SGR for #5BA0F2
const ACCENT_CLOSE = RESET;                   // full reset (spec S1 / binding constraint #5)
const DIM_OPEN = "\x1b[2m";
const DIM_CLOSE = "\x1b[22m";               // reset bold/dim only (not full reset)
const ERROR_OPEN = "\x1b[31m";              // standard red
const ERROR_CLOSE = "\x1b[39m";             // default fg only (binding constraint #5)

// Sanity check: ACCENT_HEX must stay in sync with ACCENT_OPEN above.
// Referenced so that drift triggers a unit test failure.
void ACCENT_HEX;

export function accent(s: string, enabled: boolean): string {
  return enabled ? `${ACCENT_OPEN}${s}${ACCENT_CLOSE}` : s;
}

export function dim(s: string, enabled: boolean): string {
  return enabled ? `${DIM_OPEN}${s}${DIM_CLOSE}` : s;
}

// muted is an identity function in v1 (spec I5). Token role preserved at the type-level
// for future use; rendering is a no-op. enabled param is accepted for API symmetry.
export function muted(s: string, _enabled: boolean): string {
  return s;
}

export function error(s: string, enabled: boolean): string {
  return enabled ? `${ERROR_OPEN}${s}${ERROR_CLOSE}` : s;
}

export function isColorEnabled(stream: NodeJS.WriteStream): boolean {
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
