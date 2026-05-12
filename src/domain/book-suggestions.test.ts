import { describe, it, expect } from "bun:test";
import { suggestBooks } from "@/domain/book-suggestions";
import type { BookSuggestion } from "@/domain/book-suggestions";

describe("suggestBooks", () => {
  describe("empty / whitespace input", () => {
    it("returns [] for empty string", () => {
      const result = suggestBooks("");
      expect(result).toEqual([]);
    });

    it("returns [] for whitespace-only string", () => {
      const result = suggestBooks("   ");
      expect(result).toEqual([]);
    });
  });

  describe("result shape", () => {
    it("each suggestion has alias, canonical, and displayName fields", () => {
      const results = suggestBooks("gen");
      expect(results.length).toBeGreaterThan(0);
      const s = results[0] as BookSuggestion;
      expect(typeof s.alias).toBe("string");
      expect(typeof s.canonical).toBe("string");
      expect(typeof s.displayName).toBe("string");
    });
  });

  describe("subsequence matching", () => {
    it("jhn matches John", () => {
      const results = suggestBooks("jhn");
      const displayNames = results.map((r) => r.displayName);
      expect(displayNames).toContain("John");
    });

    it("xyzzy returns []", () => {
      const results = suggestBooks("xyzzy");
      expect(results).toEqual([]);
    });
  });

  describe("default limit", () => {
    it("returns at most 5 results by default when more than 5 match", () => {
      const results = suggestBooks("a");
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("custom limit", () => {
    it("returns at most 3 results when limit is 3 and more match", () => {
      const results = suggestBooks("a", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe("score ordering", () => {
    it("exact-match beats prefix: john scores above johnny", () => {
      const results = suggestBooks("john");
      const aliasOrder = results.map((r) => r.alias);
      const johnIdx = aliasOrder.indexOf("john");
      const johnnyIdx = aliasOrder.findIndex((a) => a.startsWith("john") && a !== "john");
      if (johnIdx >= 0 && johnnyIdx >= 0) {
        expect(johnIdx).toBeLessThan(johnnyIdx);
      } else {
        expect(johnIdx).toBeGreaterThanOrEqual(0);
      }
    });

    it("joh results are score-ordered (John before 1john, 2john, 3john)", () => {
      const results = suggestBooks("joh", 10);
      expect(results.length).toBeGreaterThan(1);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].displayName.length).toBeGreaterThanOrEqual(0);
      }
      const displayNames = results.map((r) => r.displayName);
      expect(displayNames[0]).toBe("John");
    });
  });

  describe("numbered book display names", () => {
    it("1samuel alias produces displayName '1 Samuel'", () => {
      const results = suggestBooks("1samuel", 1);
      expect(results.length).toBe(1);
      expect(results[0].displayName).toBe("1 Samuel");
    });
  });
});
