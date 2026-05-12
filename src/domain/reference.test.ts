import { describe, it, expect } from "bun:test";
import { parseReference } from "@/domain/reference";

describe("parseReference", () => {
  it("parses 'john 3:16' to JHN reference", () => {
    const result = parseReference("john 3:16");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book as string).toBe("JHN");
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 16, end: 16 });
  });

  it("parses 'JOHN 3:16' case-insensitively — SCN-6", () => {
    const result = parseReference("JOHN 3:16");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book as string).toBe("JHN");
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 16, end: 16 });
  });

  it("parses alias 'Jn 3:16' to JHN", () => {
    const result = parseReference("Jn 3:16");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book as string).toBe("JHN");
  });

  it("returns unknown_book for 'xyzzy 99:99' — SCN-3", () => {
    const result = parseReference("xyzzy 99:99");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown_book");
    if (result.error.kind === "unknown_book") {
      expect(result.error.input).toBe("xyzzy");
    }
  });

  it("returns malformed_chapter_verse for 'john abc'", () => {
    const result = parseReference("john abc");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed_chapter_verse");
  });

  it("returns empty_input for an empty string", () => {
    const result = parseReference("");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("empty_input");
  });

  it("returns empty_input for whitespace-only string", () => {
    const result = parseReference("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("empty_input");
  });

  it("returns malformed_chapter_verse for non-integer chapter token without colon", () => {
    const result = parseReference("john 3abc");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed_chapter_verse");
  });

  it("returns malformed_chapter_verse for zero chapter", () => {
    const result = parseReference("john 0:16");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed_chapter_verse");
  });

  it("parses 'john 3' to whole-chapter ref", () => {
    const result = parseReference("john 3");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book as string).toBe("JHN");
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 1, end: Number.MAX_SAFE_INTEGER });
  });

  it("parses 'john 3 ' (trailing space) to whole-chapter ref", () => {
    const result = parseReference("john 3 ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 1, end: Number.MAX_SAFE_INTEGER });
  });

  it("parses 'JOHN 3' case-insensitively to whole-chapter ref", () => {
    const result = parseReference("JOHN 3");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book as string).toBe("JHN");
    expect(result.value.chapter).toBe(3);
  });

  it("rejects 'jhn 3x' with malformed_chapter_verse", () => {
    const result = parseReference("jhn 3x");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed_chapter_verse");
  });

  it("rejects 'john 0' — chapter must be ≥1", () => {
    const result = parseReference("john 0");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed_chapter_verse");
  });
});
