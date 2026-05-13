// Why: Zod schemas are the trust boundary — only this file and the adapter
// import zod. Domain and application see plain TypeScript types — R4.
// Unknown chapter content types (e.g. "poetry") are dropped rather than
// causing a fatal parse failure, so future API additions don't break v1.

import { z } from "zod";

// verse.content is a mixed array: string segments + { noteId } footnote refs.
export const RawVerseContentItemSchema = z.union([
  z.string(),
  z.object({ noteId: z.number() }),
]);

export const RawVerseSchema = z.object({
  type: z.literal("verse"),
  number: z.number(),
  content: z.array(RawVerseContentItemSchema),
});

// z.discriminatedUnion rejects unknown "type" values — that's acceptable for
// v1. If helloao adds new types, the item is dropped by the filter in the
// adapter (unknown items produce a parse error and are excluded).
// We use a passthrough object as the catch-all so the schema itself doesn't
// throw on unknown types.
const RawHeadingSchema = z.object({
  type: z.literal("heading"),
  content: z.array(z.string()),
});

const RawLineBreakSchema = z.object({
  type: z.literal("line_break"),
});

// Known chapter content item types. Anything else is an unknown object — the
// adapter filters to only type==="verse" so unknown types are silently dropped.
export const RawChapterContentItemSchema = z.union([
  RawVerseSchema,
  RawHeadingSchema,
  RawLineBreakSchema,
  // Catch-all: accept any object with a type field so unknown future types
  // don't cause a schema failure at the top level.
  z.object({ type: z.string() }).passthrough(),
]);

export const RawTranslationSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  englishName: z.string(),
  textDirection: z.enum(["ltr", "rtl"]).optional().default("ltr"),
}).passthrough();

export const RawTranslationsResponseSchema = z.object({
  translations: z.array(RawTranslationSchema),
}).passthrough();

export const RawChapterResponseSchema = z.object({
  translation: z.object({ id: z.string() }),
  book: z.object({ id: z.string() }),
  chapter: z.object({
    number: z.number(),
    content: z.array(RawChapterContentItemSchema),
  }),
  // footnotes, audioLinks, etc. are present in the real API but out of v1 scope.
  // passthrough allows them without failing.
}).passthrough();
