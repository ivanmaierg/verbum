// src/cli/ansi.test.ts — unit tests for ANSI helpers and isColorEnabled detector.
// Pure tests — no terminal allocation, no IO. process.env is mutated and restored.

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { accent, dim, muted, error, isColorEnabled, RESET } from "./ansi";

const ttyStream = { isTTY: true } as NodeJS.WriteStream;
const pipeStream = { isTTY: false } as NodeJS.WriteStream;

describe("ansi helpers — color enabled", () => {
  it("accent wraps with truecolor SGR for #5BA0F2 and full-resets", () => {
    expect(accent("hi", true)).toBe("\x1b[38;2;91;160;242mhi\x1b[0m");
  });
  it("dim wraps with attr 2 and resets with 22", () => {
    expect(dim("hi", true)).toBe("\x1b[2mhi\x1b[22m");
  });
  it("error wraps with ANSI 31 and closes with 39", () => {
    expect(error("oops", true)).toBe("\x1b[31moops\x1b[39m");
  });
  it("muted is identity even when enabled", () => {
    expect(muted("x", true)).toBe("x");
  });
  it("RESET escape is the full-reset SGR", () => {
    expect(RESET).toBe("\x1b[0m");
  });
});

describe("ansi helpers — color disabled (identity)", () => {
  it("accent passthrough", () => { expect(accent("hi", false)).toBe("hi"); });
  it("dim passthrough", () => { expect(dim("hi", false)).toBe("hi"); });
  it("error passthrough", () => { expect(error("oops", false)).toBe("oops"); });
  it("muted passthrough", () => { expect(muted("x", false)).toBe("x"); });
});

describe("isColorEnabled — truth table", () => {
  let savedNoColor: string | undefined;
  let savedForceColor: string | undefined;

  beforeEach(() => {
    savedNoColor = process.env.NO_COLOR;
    savedForceColor = process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
  });

  afterEach(() => {
    if (savedNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = savedNoColor;
    }
    if (savedForceColor === undefined) {
      delete process.env.FORCE_COLOR;
    } else {
      process.env.FORCE_COLOR = savedForceColor;
    }
  });

  it("T1 default TTY → enabled", () => {
    expect(isColorEnabled(ttyStream)).toBe(true);
  });
  it("T2 default non-TTY → disabled", () => {
    expect(isColorEnabled(pipeStream)).toBe(false);
  });
  it("T3 NO_COLOR=1 TTY → disabled", () => {
    process.env.NO_COLOR = "1";
    expect(isColorEnabled(ttyStream)).toBe(false);
  });
  it('T4 NO_COLOR="" TTY → enabled (empty = no opinion)', () => {
    process.env.NO_COLOR = "";
    expect(isColorEnabled(ttyStream)).toBe(true);
  });
  it("T5 FORCE_COLOR=1 non-TTY → enabled", () => {
    process.env.FORCE_COLOR = "1";
    expect(isColorEnabled(pipeStream)).toBe(true);
  });
  it("T6 FORCE_COLOR=0 TTY → disabled (npm convention)", () => {
    process.env.FORCE_COLOR = "0";
    expect(isColorEnabled(ttyStream)).toBe(false);
  });
  it("T7 FORCE_COLOR=false TTY → disabled (npm convention)", () => {
    process.env.FORCE_COLOR = "false";
    expect(isColorEnabled(ttyStream)).toBe(false);
  });
  it("T8 NO_COLOR=1 + FORCE_COLOR=1 → disabled (NO_COLOR wins, no-color.org)", () => {
    process.env.NO_COLOR = "1";
    process.env.FORCE_COLOR = "1";
    expect(isColorEnabled(pipeStream)).toBe(false);
  });
  it("T9 FORCE_COLOR=true non-TTY → enabled", () => {
    process.env.FORCE_COLOR = "true";
    expect(isColorEnabled(pipeStream)).toBe(true);
  });
});
