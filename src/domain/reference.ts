// Why: parseReference is the single entry point for user input — all normalization
// and validation happens here so the rest of the codebase only sees validated
// Reference values. Pure function, no IO, no Zod — R1, R4.

import type { Result } from "@/domain/result";
import type { ParseError } from "@/domain/errors";
import { makeBookId, type BookId } from "@/domain/book-id";

// VerseRange.start === end for single-verse references (the only v1 shape).
// Invariant: 1 <= start <= end — enforced by parseReference, not by the type.
export type VerseRange = { start: number; end: number };

// Reference is the validated representation of "john 3:16".
// v1 shape: one book + one chapter + one verse range.
export type Reference = {
  book: BookId;
  chapter: number;
  verses: VerseRange;
};

// ---------------------------------------------------------------------------
// Book alias map — normalised lookup: lower-case alias → USFM canonical ID.
// Add aliases here when new books need coverage; domain logic stays unchanged.
// ---------------------------------------------------------------------------
const BOOK_ALIASES: Record<string, string> = {
  // Genesis
  genesis: "GEN", gen: "GEN",
  // Exodus
  exodus: "EXO", exo: "EXO",
  // Leviticus
  leviticus: "LEV", lev: "LEV",
  // Numbers
  numbers: "NUM", num: "NUM",
  // Deuteronomy
  deuteronomy: "DEU", deu: "DEU", deut: "DEU",
  // Joshua
  joshua: "JOS", jos: "JOS",
  // Judges
  judges: "JDG", jdg: "JDG", judg: "JDG",
  // Ruth
  ruth: "RUT", rut: "RUT",
  // 1 Samuel
  "1samuel": "1SA", "1sam": "1SA", "1sa": "1SA",
  // 2 Samuel
  "2samuel": "2SA", "2sam": "2SA", "2sa": "2SA",
  // 1 Kings
  "1kings": "1KI", "1ki": "1KI", "1kgs": "1KI",
  // 2 Kings
  "2kings": "2KI", "2ki": "2KI", "2kgs": "2KI",
  // 1 Chronicles
  "1chronicles": "1CH", "1ch": "1CH", "1chr": "1CH",
  // 2 Chronicles
  "2chronicles": "2CH", "2ch": "2CH", "2chr": "2CH",
  // Ezra
  ezra: "EZR", ezr: "EZR",
  // Nehemiah
  nehemiah: "NEH", neh: "NEH",
  // Esther
  esther: "EST", est: "EST",
  // Job
  job: "JOB",
  // Psalms
  psalms: "PSA", psalm: "PSA", psa: "PSA", ps: "PSA",
  // Proverbs
  proverbs: "PRO", prov: "PRO", pro: "PRO",
  // Ecclesiastes
  ecclesiastes: "ECC", ecc: "ECC", eccl: "ECC",
  // Song of Solomon
  "song": "SNG", "songofsolomon": "SNG", "sng": "SNG", "sos": "SNG",
  // Isaiah
  isaiah: "ISA", isa: "ISA",
  // Jeremiah
  jeremiah: "JER", jer: "JER",
  // Lamentations
  lamentations: "LAM", lam: "LAM",
  // Ezekiel
  ezekiel: "EZK", ezk: "EZK", ezek: "EZK",
  // Daniel
  daniel: "DAN", dan: "DAN",
  // Hosea
  hosea: "HOS", hos: "HOS",
  // Joel
  joel: "JOL", jol: "JOL",
  // Amos
  amos: "AMO", amo: "AMO",
  // Obadiah
  obadiah: "OBA", oba: "OBA",
  // Jonah
  jonah: "JON", jon: "JON",
  // Micah
  micah: "MIC", mic: "MIC",
  // Nahum
  nahum: "NAM", nah: "NAM",
  // Habakkuk
  habakkuk: "HAB", hab: "HAB",
  // Zephaniah
  zephaniah: "ZEP", zep: "ZEP",
  // Haggai
  haggai: "HAG", hag: "HAG",
  // Zechariah
  zechariah: "ZEC", zec: "ZEC", zech: "ZEC",
  // Malachi
  malachi: "MAL", mal: "MAL",
  // Matthew
  matthew: "MAT", matt: "MAT", mat: "MAT",
  // Mark
  mark: "MRK", mrk: "MRK",
  // Luke
  luke: "LUK", luk: "LUK",
  // John — SCN-6: "john", "JOHN", "Jn" all → "JHN"
  john: "JHN", jhn: "JHN", jn: "JHN",
  // Acts
  acts: "ACT", act: "ACT",
  // Romans
  romans: "ROM", rom: "ROM",
  // 1 Corinthians
  "1corinthians": "1CO", "1cor": "1CO", "1co": "1CO",
  // 2 Corinthians
  "2corinthians": "2CO", "2cor": "2CO", "2co": "2CO",
  // Galatians
  galatians: "GAL", gal: "GAL",
  // Ephesians
  ephesians: "EPH", eph: "EPH",
  // Philippians
  philippians: "PHP", php: "PHP", phil: "PHP",
  // Colossians
  colossians: "COL", col: "COL",
  // 1 Thessalonians
  "1thessalonians": "1TH", "1thess": "1TH", "1th": "1TH",
  // 2 Thessalonians
  "2thessalonians": "2TH", "2thess": "2TH", "2th": "2TH",
  // 1 Timothy
  "1timothy": "1TI", "1tim": "1TI", "1ti": "1TI",
  // 2 Timothy
  "2timothy": "2TI", "2tim": "2TI", "2ti": "2TI",
  // Titus
  titus: "TIT", tit: "TIT",
  // Philemon
  philemon: "PHM", phm: "PHM", phlm: "PHM",
  // Hebrews
  hebrews: "HEB", heb: "HEB",
  // James
  james: "JAS", jas: "JAS",
  // 1 Peter
  "1peter": "1PE", "1pet": "1PE", "1pe": "1PE",
  // 2 Peter
  "2peter": "2PE", "2pet": "2PE", "2pe": "2PE",
  // 1 John
  "1john": "1JN", "1jn": "1JN",
  // 2 John
  "2john": "2JN", "2jn": "2JN",
  // 3 John
  "3john": "3JN", "3jn": "3JN",
  // Jude
  jude: "JUD", jud: "JUD",
  // Revelation
  revelation: "REV", rev: "REV",
};

// parseReference — the single parsing entry point for user references.
// Accepts <book-alias> <chapter> or <book-alias> <chapter>:<verse>.
// Returns a validated Reference or a ParseError — never throws (R1).
export function parseReference(input: string): Result<Reference, ParseError> {
  const trimmed = input.trim();

  // Empty or whitespace-only input.
  if (trimmed.length === 0) {
    return { ok: false, error: { kind: "empty_input" } };
  }

  // Split on first space: everything before is the book token.
  // "john 3:16" → ["john", "3:16"]
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    // No space found — no chapter:verse token at all.
    return {
      ok: false,
      error: { kind: "malformed_chapter_verse", input: trimmed },
    };
  }

  const rawBook = trimmed.slice(0, spaceIdx);
  const rest = trimmed.slice(spaceIdx + 1).trim();

  // Resolve book alias case-insensitively (SCN-6).
  const canonicalId = BOOK_ALIASES[rawBook.toLowerCase()];
  if (canonicalId === undefined) {
    return { ok: false, error: { kind: "unknown_book", input: rawBook } };
  }

  const bookResult = makeBookId(canonicalId);
  if (!bookResult.ok) {
    // Should not happen — alias map only contains valid USFM codes.
    return { ok: false, error: { kind: "unknown_book", input: rawBook } };
  }

  // Parse <chapter>:<verse> or <chapter> (whole-chapter).
  const colonIdx = rest.indexOf(":");

  if (colonIdx === -1) {
    // No colon: accept whole-chapter refs (<book> <chapter>).
    const chapter = parseInt(rest, 10);
    if (!Number.isInteger(chapter) || chapter < 1 || rest !== String(chapter)) {
      return {
        ok: false,
        error: { kind: "malformed_chapter_verse", input: rest },
      };
    }
    return {
      ok: true,
      value: {
        book: bookResult.value,
        chapter,
        verses: { start: 1, end: Number.MAX_SAFE_INTEGER },
      },
    };
  }

  const rawChapter = rest.slice(0, colonIdx);
  const rawVerse = rest.slice(colonIdx + 1);

  const chapter = parseInt(rawChapter, 10);
  const verse = parseInt(rawVerse, 10);

  if (
    !Number.isInteger(chapter) || chapter < 1 ||
    !Number.isInteger(verse) || verse < 1 ||
    rawChapter !== String(chapter) ||
    rawVerse !== String(verse)
  ) {
    return {
      ok: false,
      error: { kind: "malformed_chapter_verse", input: rest },
    };
  }

  return {
    ok: true,
    value: {
      book: bookResult.value,
      chapter,
      verses: { start: verse, end: verse },
    },
  };
}
