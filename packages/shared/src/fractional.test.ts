import { describe, expect, it } from "vitest";
import { BASE62, generateKeyBetween, generateNKeysBetween, INITIAL_POSITION } from "./fractional";

describe("generateKeyBetween", () => {
  it("returns a middle key for an empty list", () => {
    expect(generateKeyBetween(null, null)).toBe(INITIAL_POSITION);
  });

  it("returns a key after the last item", () => {
    const key = generateKeyBetween("n", null);
    expect(key > "n").toBe(true);
    expect(generateKeyBetween(key, null) > key).toBe(true);
  });

  it("returns a key before the first item", () => {
    const key = generateKeyBetween(null, "n");
    expect(key < "n").toBe(true);
    expect(key).not.toBe("");
  });

  it("handles adjacent keys with one digit left", () => {
    const key = generateKeyBetween("a", "b");
    expect("a" < key && key < "b").toBe(true);
  });

  it("handles keys that share a prefix", () => {
    const key = generateKeyBetween("a1", "a2");
    expect("a1" < key && key < "a2").toBe(true);
  });

  it("supports appending many times", () => {
    let last: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 500; i += 1) {
      last = generateKeyBetween(last, null);
      keys.push(last);
    }
    expect(new Set(keys).size).toBe(keys.length);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it("supports prepending many times", () => {
    let first: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 500; i += 1) {
      first = generateKeyBetween(null, first);
      keys.unshift(first);
    }
    expect(keys).toEqual([...keys].sort());
  });

  it("keeps ordering when inserting between neighbours repeatedly", () => {
    let left = generateKeyBetween(null, null);
    let right = generateKeyBetween(left, null);
    for (let i = 0; i < 200; i += 1) {
      const mid = generateKeyBetween(left, right);
      expect(left < mid && mid < right).toBe(true);
      if (i % 2 === 0) left = mid;
      else right = mid;
    }
  });

  it("rejects invalid ranges", () => {
    expect(() => generateKeyBetween("b", "a")).toThrow();
    expect(() => generateKeyBetween("a", "a")).toThrow();
    expect(() => generateKeyBetween("a0", null)).toThrow();
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => generateKeyBetween("n!", null)).toThrow();
  });

  it("uses the whole base62 alphabet in order", () => {
    expect([...BASE62].sort().join("")).toBe(BASE62);
  });
});

describe("generateNKeysBetween", () => {
  it("produces increasing distinct keys", () => {
    const keys = generateNKeysBetween("A", "B", 10);
    expect(keys).toHaveLength(10);
    expect(new Set(keys).size).toBe(10);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    expect(keys[0] > "A").toBe(true);
    expect(keys[keys.length - 1] < "B").toBe(true);
  });
});
