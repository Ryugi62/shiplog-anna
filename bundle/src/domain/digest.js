// Domain: WeekDigest — the facts a draft is allowed to use.
import { parseChanges } from "./changes.js";
import { extractNumbers } from "./numbers.js";

export const MAX_HIGHLIGHTS = 12;
export const MAX_INPUT_CHARS = 12000;

const PRIORITY = ["release", "feat", "perf", "fix", "refactor", "docs", "test", "other"];
const VERSION = /\bv?\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.]+)?\b/g;

/**
 * @typedef {import("./changes.js").Change} Change
 * @typedef {{
 *   changeCount: number, shippedCount: number, noiseCount: number,
 *   counts: Record<string, number>, highlights: Change[], versions: string[], refs: string[],
 *   knownNumbers: Set<string>, truncated: boolean, isUsable: boolean
 * }} WeekDigest
 */

/**
 * @param {string} notes
 * @returns {WeekDigest}
 */
export function digestNotes(notes) {
  const text = typeof notes === "string" ? notes.slice(0, MAX_INPUT_CHARS) : "";
  const changes = parseChanges(text);
  const counts = {};
  for (const c of changes) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
  const noiseCount = counts.noise ?? 0;
  const meaningful = changes.filter((c) => c.kind !== "noise");
  const ordered = PRIORITY.flatMap((kind) => meaningful.filter((c) => c.kind === kind));
  const highlights = ordered.slice(0, MAX_HIGHLIGHTS);

  const versions = [];
  for (const c of meaningful) {
    for (const v of c.subject.match(VERSION) ?? []) {
      if (/^v/i.test(v) || c.kind === "release") versions.push(v);
    }
  }
  const refs = meaningful.map((c) => c.ref).filter(Boolean);

  const knownNumbers = new Set();
  for (const c of changes) {
    for (const n of extractNumbers(c.subject)) knownNumbers.add(n);
    if (c.ref) knownNumbers.add(c.ref.replace("#", ""));
  }
  const derived = [changes.length, meaningful.length, noiseCount, highlights.length, ...Object.values(counts)];
  for (const n of derived) knownNumbers.add(String(n));

  return {
    changeCount: changes.length,
    shippedCount: meaningful.length,
    noiseCount,
    counts,
    highlights,
    versions: [...new Set(versions)],
    refs,
    knownNumbers,
    truncated: ordered.length > MAX_HIGHLIGHTS || (typeof notes === "string" && notes.length > MAX_INPUT_CHARS),
    isUsable: meaningful.length > 0,
  };
}
