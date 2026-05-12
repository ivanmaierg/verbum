// src/cli/render.test.ts — unit tests for CLI render functions.
// Pre-change baselines captured before render.ts edits to lock I10/I11/I12 invariants.

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { renderPassage, renderParseError, renderRepoError } from "./render";
import type { ParseError, RepoError } from "@/domain/errors";
import type { Passage } from "@/domain/passage";
import type { Reference } from "@/domain/reference";
import { makeBookId } from "@/domain/book-id";

// --- Fixtures ---

const jhnResult = makeBookId("JHN");
if (!jhnResult.ok) throw new Error("test fixture: JHN must be a valid BookId");

const johnRef: Reference = {
  book: jhnResult.value,
  chapter: 3,
  verses: { start: 16, end: 16 },
};

const passage: Passage = {
  reference: johnRef,
  verses: [{ number: 16, text: "For God so loved the world." }],
};

const PASSAGE_PLAIN = "For God so loved the world.";

const parseErr: ParseError = { kind: "unknown_book", input: "foo" };
const PARSE_ERR_PLAIN = `Error: unknown book "foo". Try a book name like "john" or "genesis".`;

const repoErr: RepoError = { kind: "network", message: "ECONNREFUSED" };
const REPO_ERR_PLAIN = "Error: network failure — ECONNREFUSED";

// --- Env restore helpers ---

let savedNoColor: string | undefined;
let savedForceColor: string | undefined;

function forceColor() {
  savedNoColor = process.env.NO_COLOR;
  savedForceColor = process.env.FORCE_COLOR;
  delete process.env.NO_COLOR;
  process.env.FORCE_COLOR = "1"; // force color on regardless of isTTY
}

function forceNoColor() {
  savedNoColor = process.env.NO_COLOR;
  savedForceColor = process.env.FORCE_COLOR;
  process.env.NO_COLOR = "1"; // force color off
  delete process.env.FORCE_COLOR;
}

function restoreEnv() {
  if (savedNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = savedNoColor;
  }
  if (savedForceColor === undefined) {
    delete process.env.FORCE_COLOR;
  } else {
    process.env.FORCE_COLOR = savedForceColor;
  }
}

// --- renderPassage ---

describe("renderPassage — color disabled (identity baseline, I10/I12)", () => {
  beforeEach(forceNoColor);
  afterEach(restoreEnv);

  it("returns byte-for-byte identical output to pre-change baseline", () => {
    expect(renderPassage(passage)).toBe(PASSAGE_PLAIN);
  });
});

describe("renderPassage — color enabled (text token = identity in v1, I12)", () => {
  beforeEach(forceColor);
  afterEach(restoreEnv);

  it("returns byte-for-byte identical output (no escapes — text token is identity)", () => {
    expect(renderPassage(passage)).toBe(PASSAGE_PLAIN);
  });
});

// --- renderParseError ---

describe("renderParseError — color disabled (I11)", () => {
  beforeEach(forceNoColor);
  afterEach(restoreEnv);

  it("returns byte-for-byte identical output to pre-change baseline", () => {
    expect(renderParseError(parseErr)).toBe(PARSE_ERR_PLAIN);
  });
});

describe("renderParseError — color enabled (S10)", () => {
  beforeEach(forceColor);
  afterEach(restoreEnv);

  it("wraps output in ANSI 31 red with default-fg close (\\x1b[31m...\\x1b[39m)", () => {
    expect(renderParseError(parseErr)).toBe(`\x1b[31m${PARSE_ERR_PLAIN}\x1b[39m`);
  });
});

// --- renderRepoError ---

describe("renderRepoError — color disabled (I11)", () => {
  beforeEach(forceNoColor);
  afterEach(restoreEnv);

  it("returns byte-for-byte identical output to pre-change baseline", () => {
    expect(renderRepoError(repoErr)).toBe(REPO_ERR_PLAIN);
  });
});

describe("renderRepoError — color enabled (S10)", () => {
  beforeEach(forceColor);
  afterEach(restoreEnv);

  it("wraps output in ANSI 31 red with default-fg close (\\x1b[31m...\\x1b[39m)", () => {
    expect(renderRepoError(repoErr)).toBe(`\x1b[31m${REPO_ERR_PLAIN}\x1b[39m`);
  });
});
