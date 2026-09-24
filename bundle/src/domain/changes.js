// Domain: turn raw "ship notes" (git log, bullets, release notes) into Changes.
// Pure — no I/O, no SDK.

/** @typedef {"feat"|"fix"|"perf"|"refactor"|"docs"|"test"|"release"|"noise"|"other"} ChangeKind */
/** @typedef {{kind: ChangeKind, scope: string|null, subject: string, ref: string|null, breaking: boolean}} Change */

const CONVENTIONAL = /^(feat|feature|fix|bugfix|hotfix|perf|refactor|docs|doc|test|tests|build|ci|chore|style|revert|release)(?:\(([^)]*)\))?(!)?:\s*(.+)$/i;

const TYPE_MAP = {
  feat: "feat", feature: "feat",
  fix: "fix", bugfix: "fix", hotfix: "fix", revert: "fix",
  perf: "perf",
  refactor: "refactor",
  docs: "docs", doc: "docs",
  test: "test", tests: "test",
  release: "release",
  build: "noise", ci: "noise", chore: "noise", style: "noise",
};

const NOISE_PATTERNS = [
  /^merge (pull request|branch|remote-tracking|tag)\b/i,
  /^merged? .* into /i,
  /\bbump(s|ed)? [\w@/.-]+ from [\w.-]+ to [\w.-]+/i,
  /^bump(s|ed)? (deps|dependencies|version)\b/i,
  /^(update|upgrade)d? (deps|dependencies|lockfile|package-lock|yarn\.lock)\b/i,
  /\btypos?\b/i,
  /^wip\b/i,
  /^(format|formatting|prettier|lint|linting|run prettier|eslint)\b/i,
  /^initial commit$/i,
];

const KEYWORD_RULES = [
  ["release", /\b(release[ds]?|v\d+\.\d+(\.\d+)?\b|launch(ed)? v?\d)/i],
  ["fix", /\b(fix(e[sd])?|bug|crash|resolve[sd]?|patch(ed)?|broken|error|issue)\b/i],
  ["perf", /\b(faster|speed|perf|performance|optimi[sz]e[ds]?|latency|quicker|lighter)\b/i],
  ["refactor", /\b(refactor(ed|ing)?|clean ?up|cleaned up|rename[ds]?|restructure[ds]?|simplif(y|ied))\b/i],
  ["docs", /\b(docs?|readme|documentation|guide)\b/i],
  ["test", /\b(tests?|coverage|e2e|unit tests?)\b/i],
  ["feat", /\b(add(ed|s)?|new|implement(ed|s)?|introduce[ds]?|support(s|ed)?|launch(ed)?|ship(ped)?|build|built|create[ds]?|enable[ds]?|allow(s|ed)?)\b/i],
];

const HEADER_LINE = /^(author|date|merge|commitdate|authordate|signed-off-by|co-authored-by):/i;
const COMMIT_LINE = /^commit [0-9a-f]{7,40}\b/i;
const LEADING_SHA = /^[0-9a-f]{7,40}\s+/i;
const LEADING_BULLET = /^(?:[-*•+]|\d+[.)])\s+/;
const TRAILING_REF = /\s*\((#\d+)\)\s*$/;

/**
 * @param {string|undefined|null} notes
 * @returns {Change[]}
 */
export function parseChanges(notes) {
  if (typeof notes !== "string" || notes.trim() === "") return [];
  const changes = [];
  for (const rawLine of notes.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    if (COMMIT_LINE.test(line) || HEADER_LINE.test(line)) continue;
    line = line.replace(LEADING_BULLET, "").replace(LEADING_SHA, "").trim();
    if (!line) continue;
    changes.push(classify(line));
  }
  return changes;
}

/** @param {string} line @returns {Change} */
function classify(line) {
  let ref = null;
  const refMatch = line.match(TRAILING_REF);
  if (refMatch) {
    ref = refMatch[1];
    line = line.replace(TRAILING_REF, "").trim();
  }
  const conv = line.match(CONVENTIONAL);
  if (conv) {
    const [, type, scope, bang, subject] = conv;
    let kind = TYPE_MAP[type.toLowerCase()] ?? "other";
    const cleanSubject = subject.trim();
    if (kind !== "noise" && isNoise(cleanSubject)) kind = "noise";
    return { kind, scope: scope ? scope.trim() : null, subject: cleanSubject, ref, breaking: Boolean(bang) };
  }
  if (isNoise(line)) return { kind: "noise", scope: null, subject: line, ref, breaking: false };
  for (const [kind, re] of KEYWORD_RULES) {
    if (re.test(line)) return { kind: /** @type {ChangeKind} */ (kind), scope: null, subject: line, ref, breaking: false };
  }
  return { kind: "other", scope: null, subject: line, ref, breaking: false };
}

/** @param {string} text */
function isNoise(text) {
  return NOISE_PATTERNS.some((re) => re.test(text));
}
