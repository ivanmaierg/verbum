import { describe, it, expect } from "bun:test";
import { parseReference } from "@/domain/reference";

describe("parseReference", () => {
  it("parses 'john 3:16' to JHN reference", () => {
    const result = parseReference("john 3:16");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book).toBe("JHN");
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 16, end: 16 });
  });

  it("parses 'JOHN 3:16' case-insensitively — SCN-6", () => {
    const result = parseReference("JOHN 3:16");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book).toBe("JHN");
    expect(result.value.chapter).toBe(3);
    expect(result.value.verses).toEqual({ start: 16, end: 16 });
  });

  it("parses alias 'Jn 3:16' to JHN", () => {
    const result = parseReference("Jn 3:16");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.book).toBe("JHN");
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

  it("returns malformed_chapter_verse when colon is missing", () => {
    const result = parseReference("john 316");
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
});
