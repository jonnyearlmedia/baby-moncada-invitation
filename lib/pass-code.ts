/** Pass identity derived from a household slug: the same slug always gets the same record locator and barcode. */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * FNV-1a followed by the murmur3 fmix32 finalizer. The finalizer is not optional here: plain FNV-1a
 * mixes its low bits poorly, and both callers below reduce the hash with `%`, so without it distinct
 * slugs collapse onto the same code.
 */
export function seedFrom(value: string) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index += 1) seed = Math.imul(seed ^ value.charCodeAt(index), 16777619) >>> 0;
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 2246822507) >>> 0;
  seed ^= seed >>> 13;
  seed = Math.imul(seed, 3266489909) >>> 0;
  seed ^= seed >>> 16;
  return (seed >>> 0) || 1;
}

/** Six characters, each from its own hash of the slug, so codes do not share one generator sequence. */
export function confirmationCode(slug: string) {
  let code = "";
  for (let index = 0; index < 6; index += 1) code += CODE_ALPHABET[seedFrom(`${slug}:${index}`) % CODE_ALPHABET.length];
  return code;
}

/** A CSS gradient of uneven bars, so the barcode reads as printed rather than as a repeating pattern. */
export function barcodePattern(slug: string) {
  let seed = seedFrom(`${slug}-barcode`);
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const stops: string[] = [];
  let position = 0;
  while (position < 100) {
    const bar = Math.min(100, position + 0.35 + (next() % 5) * 0.3);
    stops.push(`var(--app-text) ${position}% ${bar}%`);
    const gap = Math.min(100, bar + 0.45 + (next() % 4) * 0.28);
    stops.push(`transparent ${bar}% ${gap}%`);
    position = gap;
  }
  return `linear-gradient(90deg, ${stops.join(",")})`;
}
