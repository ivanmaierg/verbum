// src/cli/loading.test.ts — unit tests for loading module (withLoading, isSpinnerEnabled).
// Pure tests — no terminal allocation, no real IO. Fake streams only.
// process.env is mutated and restored via beforeEach/afterEach per ansi.test.ts convention.

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { withLoading, isSpinnerEnabled, SPINNER_FRAMES } from "./loading";

// Fake-stream factory — returns a WriteStream-like object and captures all writes.
function fakeStream(isTTY: boolean): { stream: NodeJS.WriteStream; writes: string[] } {
  const writes: string[] = [];
  const stream = {
    isTTY,
    write(chunk: string | Uint8Array) {
      writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    },
  } as unknown as NodeJS.WriteStream;
  return { stream, writes };
}

// ─── Group 1: isSpinnerEnabled truth table ────────────────────────────────────

describe("isSpinnerEnabled — truth table", () => {
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

  it("S1 TTY no env → true", () => {
    const { stream } = fakeStream(true);
    expect(isSpinnerEnabled(stream)).toBe(true);
  });

  it("S2 pipe no env → false", () => {
    const { stream } = fakeStream(false);
    expect(isSpinnerEnabled(stream)).toBe(false);
  });

  it("S3 TTY NO_COLOR=1 → false", () => {
    process.env.NO_COLOR = "1";
    const { stream } = fakeStream(true);
    expect(isSpinnerEnabled(stream)).toBe(false);
  });

  it('S4 TTY NO_COLOR="" → true (empty = no opinion)', () => {
    process.env.NO_COLOR = "";
    const { stream } = fakeStream(true);
    expect(isSpinnerEnabled(stream)).toBe(true);
  });

  it("S5 pipe FORCE_COLOR=1 → true (FORCE_COLOR wins over isTTY=false)", () => {
    process.env.FORCE_COLOR = "1";
    const { stream } = fakeStream(false);
    expect(isSpinnerEnabled(stream)).toBe(true);
  });

  it("S6 TTY FORCE_COLOR=0 → false (npm convention)", () => {
    process.env.FORCE_COLOR = "0";
    const { stream } = fakeStream(true);
    expect(isSpinnerEnabled(stream)).toBe(false);
  });

  it("S7 TTY FORCE_COLOR=false → false (npm convention)", () => {
    process.env.FORCE_COLOR = "false";
    const { stream } = fakeStream(true);
    expect(isSpinnerEnabled(stream)).toBe(false);
  });

  it("S8 NO_COLOR=1 + FORCE_COLOR=1 → false (NO_COLOR wins, no-color.org)", () => {
    process.env.NO_COLOR = "1";
    process.env.FORCE_COLOR = "1";
    const { stream } = fakeStream(false);
    expect(isSpinnerEnabled(stream)).toBe(false);
  });
});

// ─── Group 2: No-op when spinner is disabled ──────────────────────────────────

describe("withLoading — no-op when isTTY=false", () => {
  it("T-NOOP-1 isTTY=false, fn returns 42 → no writes, result 42", async () => {
    const { stream, writes } = fakeStream(false);
    let callCount = 0;
    const result = await withLoading(stream, async () => {
      callCount++;
      return 42;
    }, { interval: 1_000_000 });
    expect(result).toBe(42);
    expect(writes).toHaveLength(0);
    expect(callCount).toBe(1);
  });

  it("T-NOOP-2 isTTY=false, fn returns Result shape → passes through unchanged", async () => {
    const { stream, writes } = fakeStream(false);
    const value = { ok: true as const, value: "verse" };
    const result = await withLoading(stream, async () => value, { interval: 1_000_000 });
    expect(result).toBe(value);
    expect(writes).toHaveLength(0);
  });
});

// ─── Group 3: TTY-true — renders frames and cleans up ────────────────────────

describe("withLoading — TTY=true renders spinner and cleans up", () => {
  it("T-TTY-1 interval=1_000_000 → first write is \\r⠋, last write is cleanup, result 7", async () => {
    const { stream, writes } = fakeStream(true);
    const result = await withLoading(stream, async () => 7, { interval: 1_000_000 });
    expect(result).toBe(7);
    // First write: initial frame before interval starts
    expect(writes[0]).toBe("\r⠋"); // \r + first Braille frame
    // Last write: cleanup erase
    expect(writes[writes.length - 1]).toBe("\r \r");
  });

  it("T-TTY-2 interval=1, fn awaits microtask → cleanup is still the last write", async () => {
    const { stream, writes } = fakeStream(true);
    await withLoading(
      stream,
      () => new Promise<void>((resolve) => setTimeout(resolve, 5)),
      { interval: 1 },
    );
    expect(writes[writes.length - 1]).toBe("\r \r");
    // At least the initial frame + at least one interval tick + cleanup
    expect(writes.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Group 4: Rejection — cleanup still fires ────────────────────────────────

describe("withLoading — rejection propagates after cleanup", () => {
  it("T-REJECT-1 isTTY=true, fn rejects → rejects with same error, cleanup is last write", async () => {
    const { stream, writes } = fakeStream(true);
    const err = new Error("nope");
    await expect(
      withLoading(stream, () => Promise.reject(err), { interval: 1_000_000 }),
    ).rejects.toThrow("nope");
    expect(writes[writes.length - 1]).toBe("\r \r");
  });
});

// ─── Group 5: Frame shape ─────────────────────────────────────────────────────

describe("SPINNER_FRAMES — shape invariants", () => {
  it("T-FRAMES-1 has exactly 10 frames", () => {
    expect(SPINNER_FRAMES).toHaveLength(10);
  });

  it("T-FRAMES-2 every frame is exactly 1 grapheme cluster", () => {
    for (const frame of SPINNER_FRAMES) {
      // Spread into Unicode code points — each Braille glyph is 1 code point.
      expect([...frame]).toHaveLength(1);
    }
  });
});
