import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { createHelloAoBibleRepository } from "@/api/hello-ao-bible-repository";
import { RawChapterResponseSchema } from "@/api/schemas";
import { makeBookId } from "@/domain/book-id";
import { DEFAULT_TRANSLATION_ID } from "@/domain/translations";
import fixtureJson from "@/api/__fixtures__/john-3-bsb.json" with { type: "json" };

const bsb = DEFAULT_TRANSLATION_ID;
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

describe("getTranslations", () => {
  const fakeTranslations = [
    { id: "BSB", name: "Berean Standard Bible", language: "en", englishName: "English", textDirection: "ltr" },
    { id: "KJV", name: "King James Version", language: "en", englishName: "English", textDirection: "ltr" },
    { id: "LSG", name: "Louis Segond", language: "fr", englishName: "French", textDirection: "ltr" },
  ];

  it("returns ok:true with sorted translations on 200 response", async () => {
    const restore = stubFetch({
      ok: true,
      json: async () => ({ translations: fakeTranslations }),
    });
    const repo = createHelloAoBibleRepository();
    const result = await repo.getTranslations();
    restore();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBe(3);
  });

  it("returns items sorted by languageEnglishName then name", async () => {
    const unsorted = [
      { id: "B", name: "Zeta Bible", language: "fr", englishName: "French", textDirection: "ltr" },
      { id: "A", name: "Alpha Bible", language: "en", englishName: "English", textDirection: "ltr" },
      { id: "C", name: "Alpha Bible", language: "fr", englishName: "French", textDirection: "ltr" },
    ];
    const restore = stubFetch({ ok: true, json: async () => ({ translations: unsorted }) });
    const repo = createHelloAoBibleRepository();
    const result = await repo.getTranslations();
    restore();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]!.languageEnglishName).toBe("English");
    expect(result.value[1]!.languageEnglishName).toBe("French");
    expect(result.value[1]!.name).toBe("Alpha Bible");
    expect(result.value[2]!.name).toBe("Zeta Bible");
  });

  it("caches — two calls share one network request", async () => {
    let callCount = 0;
    const original = globalThis.fetch;
    // @ts-expect-error — test stub
    globalThis.fetch = async () => {
      callCount++;
      return { ok: true, status: 200, json: async () => ({ translations: fakeTranslations }) };
    };
    const repo = createHelloAoBibleRepository();
    await repo.getTranslations();
    await repo.getTranslations();
    globalThis.fetch = original;
    expect(callCount).toBe(1);
  });

  it("returns ok:false on HTTP 500", async () => {
    const restore = stubFetch({ ok: false, status: 500 });
    const repo = createHelloAoBibleRepository();
    const result = await repo.getTranslations();
    restore();
    expect(result.ok).toBe(false);
  });

  it("returns ok:false with schema_mismatch on malformed JSON", async () => {
    const restore = stubFetch({ ok: true, json: async () => ({ wrong: "shape" }) });
    const repo = createHelloAoBibleRepository();
    const result = await repo.getTranslations();
    restore();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("schema_mismatch");
  });

  it("does not cache on error — next call retries the network", async () => {
    let callCount = 0;
    const original = globalThis.fetch;
    // @ts-expect-error — test stub
    globalThis.fetch = async () => {
      callCount++;
      return { ok: false, status: 500 };
    };
    const repo = createHelloAoBibleRepository();
    await repo.getTranslations();
    await repo.getTranslations();
    globalThis.fetch = original;
    expect(callCount).toBe(2);
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
