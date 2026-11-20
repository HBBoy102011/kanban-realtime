/**
 * Fractional indexing over base62 strings.
 *
 * Card and column positions are strings so that moving one item only rewrites
 * that item: a new key is generated between its two neighbours. No other rows
 * need to change, which keeps drag-and-drop O(1) on the server and avoids
 * write storms when many people drag cards at the same time.
 *
 * Invariants: a key is a non-empty base62 string; a multi-character key never
 * ends with "0" and the single character "0" is never used. This leaves room to
 * generate a key before any existing key.
 */
export const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const ZERO = BASE62[0];
const MIDDLE = BASE62[Math.floor(BASE62.length / 2)];

function assertValidKey(key: string, digits: string): void {
  if (key.length === 0) throw new Error("invalid key: empty");
  for (const char of key) {
    if (!digits.includes(char)) throw new Error(`invalid key: "${key}" contains "${char}"`);
  }
  if (key === digits[0]) throw new Error(`invalid key: "${key}" is reserved`);
  if (key.length > 1 && key.endsWith(digits[0])) {
    throw new Error(`invalid key: "${key}" must not end with "${digits[0]}"`);
  }
}

/**
 * Returns a key strictly between `a` and `b`, where `a` may be "" (before all
 * keys) and `b` may be null (after all keys).
 */
function midpoint(a: string, b: string | null, digits: string): string {
  if (b !== null && a >= b) throw new Error(`invalid key range: "${a}" >= "${b}"`);

  if (a.length === 0) {
    if (b === null) return MIDDLE;
    const firstB = digits.indexOf(b[0]);
    if (firstB === 0) return digits[0] + midpoint("", b.length > 1 ? b.slice(1) : null, digits);
    if (firstB === 1) return digits[0] + digits[Math.floor(digits.length / 2)];
    return digits[Math.floor(firstB / 2)];
  }

  if (a.length > 1 && a.endsWith(digits[0])) {
    throw new Error(`invalid key: "${a}" must not end with "${digits[0]}"`);
  }

  if (b !== null) {
    let common = 0;
    while ((common < a.length ? a[common] : digits[0]) === b[common]) common += 1;
    if (common > 0) {
      return b.slice(0, common) + midpoint(a.slice(common), b.length > common ? b.slice(common) : null, digits);
    }
  }

  const firstA = digits.indexOf(a[0]);
  const firstB = b !== null ? digits.indexOf(b[0]) : digits.length;

  if (firstB - firstA > 1) {
    return digits[Math.floor((firstA + firstB) / 2)];
  }

  return digits[firstA] + midpoint(a.slice(1), null, digits);
}

/** Returns a key that sorts strictly between `a` and `b` (either may be null). */
export function generateKeyBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  digits: string = BASE62,
): string {
  const lower = a ?? null;
  const upper = b ?? null;
  if (lower !== null) assertValidKey(lower, digits);
  if (upper !== null) assertValidKey(upper, digits);
  if (lower !== null && upper !== null && lower >= upper) {
    throw new Error(`invalid key range: "${lower}" >= "${upper}"`);
  }

  if (lower === null) {
    if (upper === null) return digits[Math.floor(digits.length / 2)];
    return midpoint("", upper, digits);
  }

  if (upper === null) {
    const firstA = digits.indexOf(lower[0]);
    if (firstA < digits.length - 1) {
      return digits[Math.floor((firstA + digits.length) / 2)];
    }
    return digits[firstA] + midpoint(lower.slice(1), null, digits);
  }

  const firstA = digits.indexOf(lower[0]);
  const firstB = digits.indexOf(upper[0]);
  if (firstA === firstB) {
    return digits[firstA] + midpoint(lower.slice(1), upper.length > 1 ? upper.slice(1) : null, digits);
  }
  if (firstB - firstA > 1) {
    return digits[Math.floor((firstA + firstB) / 2)];
  }
  return digits[firstA] + midpoint(lower.slice(1), null, digits);
}

/** Generates `count` increasing keys strictly inside (a, b). */
export function generateNKeysBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  count: number,
): string[] {
  if (count <= 0) return [];
  if (count === 1) return [generateKeyBetween(a, b)];
  const mid = generateKeyBetween(a, b);
  return [
    ...generateNKeysBetween(a, mid, Math.floor(count / 2)),
    mid,
    ...generateNKeysBetween(mid, b, count - Math.floor(count / 2) - 1),
  ];
}

/** Middle key for a brand-new list. */
export const INITIAL_POSITION = MIDDLE;
export { ZERO };
