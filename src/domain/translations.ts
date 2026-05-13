// Why: a branded TranslationId prevents raw "BSB" strings from leaking across
// layers — R6. DEFAULT_TRANSLATION_ID lives in the domain (not the CLI) so that
// every future consumer (TUI, programmatic API) shares a single source — D1.

export type TranslationId = string & { readonly __brand: "TranslationId" };

export interface Translation {
  id: TranslationId;
  name: string;
  language: string;
  languageEnglishName: string;
  textDirection: "ltr" | "rtl";
}

// v1: no validation — the caller is always internal and trusted.
// Future: validate against BibleRepository.getTranslations().
export function makeTranslationId(s: string): TranslationId {
  return s as TranslationId;
}

// Raw "BSB" is intentionally isolated here — any other file using the literal
// is a review-blocker (REQ-3).
export const DEFAULT_TRANSLATION_ID: TranslationId = makeTranslationId("BSB");
