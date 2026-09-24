// Domain: DraftCheck — limits + "every number must come from the log".
import { weightedLength, X_LIMIT, LINKEDIN_LIMIT } from "./drafts.js";
import { extractNumbers } from "./numbers.js";

export { extractNumbers };

export const MIN_DRAFT_CHARS = 40;

const DRAFT_KEYS = /** @type {const} */ (["xPost", "linkedinPost", "changelog"]);

/**
 * @typedef {{code: "EMPTY"|"TOO_SHORT"|"X_TOO_LONG"|"LINKEDIN_TOO_LONG"|"UNSUPPORTED_NUMBER", draft: string, value?: string}} DraftIssue
 * @typedef {{ok: boolean, issues: DraftIssue[]}} DraftCheck
 */

/**
 * @param {import("./drafts.js").DraftSet} drafts
 * @param {{knownNumbers: Set<string>}} digest
 * @returns {DraftCheck}
 */
export function checkDrafts(drafts, digest) {
  /** @type {DraftIssue[]} */
  const issues = [];
  for (const key of DRAFT_KEYS) {
    const text = (drafts?.[key] ?? "").trim();
    if (!text) {
      issues.push({ code: "EMPTY", draft: key });
      continue;
    }
    if (text.length < MIN_DRAFT_CHARS) issues.push({ code: "TOO_SHORT", draft: key });
    if (key === "xPost" && weightedLength(text) > X_LIMIT) issues.push({ code: "X_TOO_LONG", draft: key, value: String(weightedLength(text)) });
    if (key === "linkedinPost" && text.length > LINKEDIN_LIMIT) issues.push({ code: "LINKEDIN_TOO_LONG", draft: key, value: String(text.length) });
    const seen = new Set();
    for (const n of extractNumbers(text)) {
      if (digest.knownNumbers.has(n) || seen.has(n)) continue;
      seen.add(n);
      issues.push({ code: "UNSUPPORTED_NUMBER", draft: key, value: n });
    }
  }
  return { ok: issues.length === 0, issues };
}
