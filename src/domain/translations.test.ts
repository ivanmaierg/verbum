import { describe, it, expect } from "bun:test";
import { makeTranslationId } from "@/domain/translations";
import type { Translation, TranslationId } from "@/domain/translations";

describe("translations domain", () => {
  it("TranslationId and Translation are importable from the same path", () => {
    const id: TranslationId = makeTranslationId("BSB");
    expect(typeof id).toBe("string");
  });

  it("Translation interface has the 5 required fields with correct types", () => {
    const t: Translation = {
      id: makeTranslationId("BSB"),
      name: "Berean Standard Bible",
      language: "en",
      languageEnglishName: "English",
      textDirection: "ltr",
    };
    expect(String(t.id)).toBe("BSB");
    expect(t.name).toBe("Berean Standard Bible");
    expect(t.language).toBe("en");
    expect(t.languageEnglishName).toBe("English");
    expect(t.textDirection).toBe("ltr");
  });

  it("textDirection can be rtl", () => {
    const t: Translation = {
      id: makeTranslationId("KJV"),
      name: "Some RTL Translation",
      language: "ar",
      languageEnglishName: "Arabic",
      textDirection: "rtl",
    };
    expect(t.textDirection).toBe("rtl");
  });
});
