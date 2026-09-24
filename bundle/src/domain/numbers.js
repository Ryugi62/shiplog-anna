// Domain: number tokens used by the fact check (and by the UI highlighter — same rule, one place).
// "1,200" → "1200", "v1.4.0" → "1.4.0", "1.2s" → "1.2", "40%" → "40".
// Ordered-list markers at the start of a line ("1. ", "2) ") are not facts and are skipped.

const LIST_MARKER = /^[ \t]*\d{1,2}[.)][ \t]+/gm;
const NUMBER = /\d{1,3}(?:,\d{3})+(?!\d)|\d+(?:\.\d+)*/g;

/**
 * @param {string} text
 * @returns {{start: number, end: number, value: string}[]}
 */
export function numberSpans(text) {
  if (typeof text !== "string" || !text) return [];
  const skip = [];
  for (const m of text.matchAll(LIST_MARKER)) skip.push([m.index, m.index + m[0].length]);
  const spans = [];
  for (const m of text.matchAll(NUMBER)) {
    const start = m.index;
    if (skip.some(([a, b]) => start >= a && start < b)) continue;
    spans.push({ start, end: start + m[0].length, value: m[0].replace(/,/g, "") });
  }
  return spans;
}

/** @param {string} text @returns {string[]} */
export function extractNumbers(text) {
  return numberSpans(text).map((s) => s.value);
}
