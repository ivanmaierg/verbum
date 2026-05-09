import { describe, it, expect } from "bun:test";
import { makeBookId } from "@/domain/book-id";

describe("makeBookId", () => {
  it("accepts JHN — a canonical USFM code", () => {
    const result = makeBookId("JHN");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("JHN");
  });

  it("accepts GEN — first book in the canonical set", () => {
    const result = makeBookId("GEN");
    expect(result.ok).toBe(true);
  });

  it("rejects unknown input 'xyzzy' with kind unknown_book — SCN-3", () => {
    const result = makeBookId("xyzzy");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown_book");
    expect(result.error.input).toBe("xyzzy");
  });

  it("rejects empty string", () => {
    const result = makeBookId("");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown_book");
  });

  it("accepts REV — last book in the canonical set", () => {
    const result = makeBookId("REV");
    expect(result.ok).toBe(true);
  });

  it("rejects lowercase 'jhn' — canonical set is upper-case only", () => {
    // Alias normalisation happens in parseReference, not makeBookId.
    const result = makeBookId("jhn");
    expect(result.ok).toBe(false);
  });
});
