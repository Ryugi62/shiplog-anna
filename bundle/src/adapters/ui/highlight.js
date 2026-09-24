// UI adapter: split a draft into plain text and number segments (found in the log / not in the log).
import { numberSpans } from "../../domain/numbers.js";

/**
 * @param {string} text
 * @param {Iterable<string>} known
 * @returns {{text: string, kind: "plain"|"known"|"unknown"}[]}
 */
export function segmentNumbers(text, known) {
  const set = known instanceof Set ? known : new Set(known ?? []);
  const out = [];
  let pos = 0;
  for (const s of numberSpans(text ?? "")) {
    if (s.start > pos) out.push({ text: text.slice(pos, s.start), kind: "plain" });
    out.push({ text: text.slice(s.start, s.end), kind: set.has(s.value) ? "known" : "unknown" });
    pos = s.end;
  }
  if (pos < (text ?? "").length) out.push({ text: text.slice(pos), kind: "plain" });
  return out;
}
