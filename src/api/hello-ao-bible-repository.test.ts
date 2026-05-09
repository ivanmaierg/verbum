import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { createHelloAoBibleRepository } from "@/api/hello-ao-bible-repository";
import { RawChapterResponseSchema } from "@/api/schemas";
import { makeBookId } from "@/domain/book-id";
import { makeTranslationId } from "@/domain/translations";
import fixtureJson from "@/api/__fixtures__/john-3-bsb.json" with { type: "json" };

const bsb = makeTranslationId("BSB");
const jhn = (() => {
  const r = makeBookId("JHN");
  if (!r.ok) throw new Error("test setup: JHN must be valid");
  return r.value;
})();

// Stub fetch so tests never hit the network.
function stubFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  const original = globalThis.fetch;
  // @ts-expect-error — replacing fetch with a stub for testing
  globalThis.fetch = async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (async () => ({})),
  });
  return () => { globalThis.fetch = original; };
}

describe("RawChapterResponseSchema", () => {
  it("accepts the recorded john-3-bsb fixture — T-12 verify", () => {
    const result = RawChapterResponseSchema.safeParse(fixtureJson);
    expect(result.success).toBe(true);
  });

  it("fixture contains verse 16 with non-empty content", () => {
    const parsed = RawChapterResponseSchema.parse(fixtureJson);
    const verse16 = parsed.chapter.content.find(
      (item) => "number" in item && item.number === 16,
    );
    expect(verse16).toBeDefined();
  });
});

describe("createHelloAoBibleRepository", () => {
  describe("happy path", () => {
    let restore: () => void;

    beforeEach(() => {
      restore = stubFetch({
        ok: true,
        json: async () => fixtureJson,
      });
    });

    afterEach(() => restore());

    it("returns Chapter with non-empty verses", async () => {
      const repo = createHelloAoBibleRepository();
      const result = await repo.getChapter(bsb, jhn, 3);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.verses.length).toBeGreaterThan(0);
    });

    it("verse 16 has non-empty text with 'loved'", async () => {
      const repo = createHelloAoBibleRepository();
      const result = await repo.getChapter(bsb, jhn, 3);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const v16 = result.value.verses.find((v) => v.number === 16);
      expect(v16).toBeDefined();
      expect(v16!.text).toContain("loved");
    });

    it("toVerseText strips { noteId } objects — only string segments joined", async () => {
      const repo = createHelloAoBibleRepository();
      const result = await repo.getChapter(bsb, jhn, 3);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // verse 16 in the BSB fixture has a noteId:17 between text segments.
      // The joined text must be a plain string with no JSON-like artifacts.
      const v16 = result.value.verses.find((v) => v.number === 16);
      expect(v16!.text).not.toContain("noteId");
      expect(typeof v16!.text).toBe("string");
    });
  });

  describe("error paths", () => {
    it("returns schema_mismatch when fetch returns {}", async () => {
      const restore = stubFetch({ ok: true, json: async () => ({}) });
      const repo = createHelloAoBibleRepository();
      const result = await repo.getChapter(bsb, jhn, 3);
      restore();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe("schema_mismatch");
    });

    it("returns chapter_not_found on HTTP 404", async () => {
      const restore = stubFetch({ ok: false, status: 404 });
      const repo = createHelloAoBibleRepository();
      const result = await repo.getChapter(bsb, jhn, 3);
      restore();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe("chapter_not_found");
    });

    it("returns network error when fetch throws", async () => {
      const original = globalThis.fetch;
      // @ts-expect-error — injecting a throwing stub
      globalThis.fetch = async () => { throw new Error("Connection refused"); };
      const repo = createHelloAoBibleRepository();
      const result = await repo.getChapter(bsb, jhn, 3);
      globalThis.fetch = original;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe("network");
    });
  });
});
