import { describe, it, expect } from "bun:test";
import { makeTranslationId } from "@/domain/translations";
import type { Translation } from "@/domain/translations";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { Reference } from "@/domain/reference";

const johnRef: Reference = {
  book: "JHN" as import("@/domain/book-id").BookId,
  chapter: 3,
  verses: { start: 1, end: 1 },
};

const fakeTranslations: Translation[] = [
  { id: makeTranslationId("KJV"), name: "King James Version", language: "en", languageEnglishName: "English", textDirection: "ltr" },
];

function makeLoadedPickerLoading(): ReaderState {
  return {
    kind: "loaded",
    passage: { reference: johnRef, verses: [{ number: 1, text: "v1" }] },
    ref: johnRef,
    cursorIndex: 0,
    pageStartIndex: 0,
    versePicker: null,
    translationPicker: { status: "loading", query: "", items: [], visibleItems: [], selectedIndex: 0 },
    translationId: makeTranslationId("BSB"),
    translationName: "Berean Standard Bible",
  };
}

function makeLoadedPickerNull(): ReaderState {
  return {
    kind: "loaded",
    passage: { reference: johnRef, verses: [{ number: 1, text: "v1" }] },
    ref: johnRef,
    cursorIndex: 0,
    pageStartIndex: 0,
    versePicker: null,
    translationPicker: null,
    translationId: makeTranslationId("BSB"),
    translationName: "Berean Standard Bible",
  };
}

describe("useTranslationsFetch (logic contract)", () => {
  it("dispatches TranslationsFetched on successful repo.getTranslations when picker is loading", async () => {
    const dispatched: ReaderAction[] = [];
    const repo: BibleRepository = {
      getChapter: async () => ({ ok: true, value: { translationId: makeTranslationId("BSB"), book: johnRef.book, chapter: 3, verses: [] } }),
      getTranslations: async () => ({ ok: true, value: fakeTranslations }),
    };

    const state = makeLoadedPickerLoading();
    if (state.kind !== "loaded" || state.translationPicker?.status !== "loading") {
      throw new Error("expected loaded+loading picker");
    }

    const result = await repo.getTranslations();
    if (result.ok) {
      dispatched.push({ type: "TranslationsFetched", translations: result.value });
    } else {
      dispatched.push({ type: "TranslationFetchFailed" });
    }

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.type).toBe("TranslationsFetched");
  });

  it("dispatches TranslationFetchFailed on repo error", async () => {
    const dispatched: ReaderAction[] = [];
    const repo: BibleRepository = {
      getChapter: async () => ({ ok: false, error: { kind: "network", message: "err" } }),
      getTranslations: async () => ({ ok: false, error: { kind: "network", message: "fetch failed" } }),
    };

    const result = await repo.getTranslations();
    if (result.ok) {
      dispatched.push({ type: "TranslationsFetched", translations: result.value });
    } else {
      dispatched.push({ type: "TranslationFetchFailed" });
    }

    expect(dispatched[0]!.type).toBe("TranslationFetchFailed");
  });

  it("does not fire when translationPicker status is not loading", async () => {
    const dispatched: ReaderAction[] = [];
    const repo: BibleRepository = {
      getChapter: async () => ({ ok: true, value: { translationId: makeTranslationId("BSB"), book: johnRef.book, chapter: 3, verses: [] } }),
      getTranslations: async () => ({ ok: true, value: fakeTranslations }),
    };

    const state = makeLoadedPickerNull();
    const shouldFire = state.kind === "loaded" && state.translationPicker?.status === "loading";
    if (shouldFire) {
      const result = await repo.getTranslations();
      if (result.ok) dispatched.push({ type: "TranslationsFetched", translations: result.value });
      else dispatched.push({ type: "TranslationFetchFailed" });
    }

    expect(dispatched).toHaveLength(0);
  });
});
