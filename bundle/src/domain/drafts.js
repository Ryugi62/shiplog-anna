// Domain: DraftSet parsing and X length rules.

export const X_LIMIT = 280;
export const LINKEDIN_LIMIT = 3000;
const URL_WEIGHT = 23;
const URL = /https?:\/\/\S+/g;
const EMOJI = /\p{Extended_Pictographic}/u;

/** @typedef {{xPost: string, linkedinPost: string, changelog: string}} DraftSet */

export class DomainError extends Error {
  /** @param {string} code @param {string} [detail] */
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

/**
 * X counts most Latin-range code points as 1, everything else (CJK, Hangul, kana, emoji) as 2,
 * and any URL as 23 (twitter-text v3 weighting).
 * @param {string} text
 */
export function weightedLength(text) {
  if (!text) return 0;
  let total = 0;
  const withoutUrls = text.replace(URL, () => {
    total += URL_WEIGHT;
    return "";
  });
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  for (const { segment } of segmenter.segment(withoutUrls)) {
    if (EMOJI.test(segment)) {
      total += 2;
      continue;
    }
    for (const ch of segment) {
      const cp = ch.codePointAt(0);
      const light = cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247);
      total += light ? 1 : 2;
    }
  }
  return total;
}

/**
 * Guarantee an X post fits: unchanged when it fits, otherwise cut at a word boundary + "…".
 * @param {string} text
 * @returns {{text: string, trimmed: boolean}}
 */
export function fitXPost(text) {
  const src = (text ?? "").trim();
  if (weightedLength(src) <= X_LIMIT) return { text: src, trimmed: false };
  const budget = X_LIMIT - 1; // room for "…"
  const words = src.split(/(\s+)/);
  let acc = "";
  for (const part of words) {
    if (weightedLength(acc + part) > budget) break;
    acc += part;
  }
  acc = acc.trimEnd().replace(/[,;:\-–—]+$/, "");
  if (!acc) {
    // No spaces (e.g. CJK): cut by grapheme.
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const { segment } of segmenter.segment(src)) {
      if (weightedLength(acc + segment) > budget) break;
      acc += segment;
    }
  }
  return { text: acc + "…", trimmed: true };
}

/**
 * Extract the three drafts from a model reply (bare JSON, fenced JSON, or JSON inside prose).
 * @param {string} reply
 * @returns {DraftSet}
 */
export function parseDraftSet(reply) {
  if (typeof reply !== "string" || !reply.trim()) throw new DomainError("BAD_MODEL_OUTPUT", "empty reply");
  const candidates = [];
  const fence = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  const first = reply.indexOf("{");
  const last = reply.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(reply.slice(first, last + 1));
  candidates.push(reply);
  for (const c of candidates) {
    let obj;
    try {
      obj = JSON.parse(c.trim());
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object") continue;
    const xPost = pick(obj, "x_post", "xPost");
    const linkedinPost = pick(obj, "linkedin_post", "linkedinPost");
    const changelog = pick(obj, "changelog_md", "changelog");
    if (xPost === null || linkedinPost === null || changelog === null) {
      throw new DomainError("BAD_MODEL_OUTPUT", "missing x_post / linkedin_post / changelog_md");
    }
    return { xPost, linkedinPost, changelog };
  }
  throw new DomainError("BAD_MODEL_OUTPUT", "no JSON object found");
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (typeof obj[k] === "string") return obj[k].trim();
  }
  return null;
}
