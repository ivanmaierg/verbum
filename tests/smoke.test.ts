// Why: end-to-end smoke test wires getPassage + render with a fixture-backed
// stub so no real HTTP hits CI — REQ-13. The compiled-binary CI step (T-18)
// is the only place real HTTP runs.

import { describe, it, expect } from "bun:test";
import { getPassage } from "@/application/get-passage";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { Chapter } from "@/domain/passage";
import { makeBookId } from "@/domain/book-id";
import { makeTranslationId } from "@/domain/translations";
import { parseReference } from "@/domain/reference";
import { renderPassage, renderParseError } from "@/cli/render";
import { RawChapterResponseSchema } from "@/api/schemas";
import fixtureJson from "@/api/__fixtures__/john-3-bsb.json" with { type: "json" };

// Parse the fixture once and build a domain Chapter from it.
function buildChapterFromFixture(): Chapter {
  const parsed = RawChapterResponseSchema.parse(fixtureJson);
  const jhnResult = makeBookId("JHN");
  if (!jhnResult.ok) throw new Error("smoke test setup: JHN must be valid");

  const verses = parsed.chapter.content
    .filter((item): item is Extract<typeof item, { type: "verse" }> =>
      item.type === "verse" && "number" in item && "content" in item)
    .map((item) => {
      const content = (item as { content: Array<string | { noteId: number }> }).content;
      const text = content
        .filter((x): x is string => typeof x === "string")
        .join(" ")
        .trim();
      return { number: (item as { number: number }).number, text };
    });

  return {
    translationId: makeTranslationId("BSB"),
    book: jhnResult.value,
    chapter: 3,
    verses,
  };
}

const fixtureChapter = buildChapterFromFixture();

// Stub repository backed by the recorded fixture — no real HTTP.
const fixtureRepo: BibleRepository = {
  getChapter: async () => ({ ok: true, value: fixtureChapter }),
};

describe("smoke — john 3:16 happy path", () => {
  it("getPassage returns ok:true with verse text containing 'loved'", async () => {
    const refResult = parseReference("john 3:16");
    expect(refResult.ok).toBe(true);
    if (!refResult.ok) return;

    const passageResult = await getPassage(fixtureRepo, refResult.value);
    expect(passageResult.ok).toBe(true);
    if (!passageResult.ok) return;

    const rendered = renderPassage(passageResult.value);
    expect(rendered).toContain("loved");
    // stdout has the verse text; stderr is empty (no stderr in this test).
    expect(rendered.length).toBeGreaterThan(0);
  });
});

describe("smoke — xyzzy 99:99 unknown-book error path", () => {
  it("parseReference returns unknown_book for 'xyzzy 99:99'", () => {
    const result = parseReference("xyzzy 99:99");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown_book");
  });

  it("renderParseError output is non-empty and names 'xyzzy'", () => {
    const result = parseReference("xyzzy 99:99");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const msg = renderParseError(result.error);
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toContain("xyzzy");
  });
});
