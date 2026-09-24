// Application: prompt building for the draft and repair calls. Pure — no SDK.

export const TONES = {
  "build-in-public": "Build in public: friendly first person (\"I shipped…\"), candid and a little excited, like an indie hacker's weekly update. No corporate buzzwords.",
  professional: "Professional: clear and confident, business-appropriate, no slang, no hype words.",
  technical: "Technical: precise and developer-focused; name the components, APIs and behaviours that changed; no hype.",
};

export const LANGUAGES = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  es: "Spanish",
  de: "German",
  fr: "French",
  "pt-BR": "Brazilian Portuguese",
};

export const MAX_TOKENS = 1800;
export const TEMPERATURE = 0.5;

/** @param {{tone: string, language: string}} opts */
export function buildSystemPrompt({ tone, language }) {
  const lang = LANGUAGES[language] ?? LANGUAGES.en;
  const toneLine = TONES[tone] ?? TONES["build-in-public"];
  return [
    "You are ShipLog, an editor that turns a solo builder's weekly work log into three ready-to-post drafts.",
    "Hard rules:",
    "1. Use ONLY the facts in the WEEK DIGEST. Never invent metrics, user counts, revenue, percentages, dates, names, links or quotes.",
    "2. State a number only if it appears in the digest. If unsure, leave the number out.",
    "3. Lead with what users can now do. Leave out noise (merges, dependency bumps, typo fixes).",
    `4. Write every draft in ${lang}. Keep product names, code identifiers, PR refs like (#42) and version strings exactly as written.`,
    "5. Never use numbered lists (use \"•\" or \"-\"). No links. At most 2 hashtags in the X post and none elsewhere.",
    `Tone — ${toneLine}`,
    "Return ONE JSON object and nothing else (no prose, no code fences):",
    '{"x_post": string, "linkedin_post": string, "changelog_md": string}',
    "- x_post: a single post of at most 240 characters (CJK characters count double). Hook first, concrete.",
    "- linkedin_post: 80–220 words, short paragraphs, 2–4 \"•\" bullets with the most user-visible changes, end with one question to readers.",
    '- changelog_md: Markdown using only the relevant headings among "### Added", "### Changed", "### Fixed", "### Performance", "### Docs"; one "- " bullet per change, rewritten in user-facing words.',
  ].join("\n");
}

/**
 * @param {import("../domain/digest.js").WeekDigest} digest
 * @param {{projectName?: string}} opts
 */
export function buildDigestMessage(digest, { projectName } = {}) {
  const counts = Object.entries(digest.counts)
    .filter(([k]) => k !== "noise")
    .map(([k, n]) => `${k} ${n}`)
    .join(" · ");
  const lines = [
    "WEEK DIGEST",
    `PROJECT: ${projectName && projectName.trim() ? projectName.trim() : "(not given — do not invent a name)"}`,
    `TOTALS: ${digest.changeCount} lines in the log · ${digest.shippedCount} meaningful changes · noise skipped: ${digest.noiseCount}${counts ? ` · ${counts}` : ""}`,
  ];
  if (digest.versions.length) lines.push(`VERSIONS: ${digest.versions.join(", ")}`);
  lines.push("CHANGES (most important first):");
  for (const c of digest.highlights) {
    const scope = c.scope ? `(${c.scope}) ` : "";
    const ref = c.ref ? ` (${c.ref})` : "";
    const breaking = c.breaking ? " [BREAKING]" : "";
    lines.push(`- [${c.kind}] ${scope}${c.subject}${ref}${breaking}`);
  }
  if (digest.truncated) lines.push(`(${digest.shippedCount - digest.highlights.length} more changes not listed)`);
  return lines.join("\n");
}

/** @param {import("../domain/check.js").DraftIssue[]} issues */
export function buildRepairMessage(issues) {
  const names = { xPost: "x_post", linkedinPost: "linkedin_post", changelog: "changelog_md" };
  const lines = ["Fix these problems and return the full JSON object again (same three keys, nothing else):"];
  for (const i of issues) {
    const d = names[i.draft] ?? i.draft;
    if (i.code === "UNSUPPORTED_NUMBER") lines.push(`- ${d} states "${i.value}", which is not in the WEEK DIGEST. Remove it or use a number from the digest.`);
    else if (i.code === "X_TOO_LONG") lines.push(`- x_post is ${i.value} characters; the hard limit is 280. Rewrite it to at most 240.`);
    else if (i.code === "LINKEDIN_TOO_LONG") lines.push(`- linkedin_post is ${i.value} characters; keep it under 1,500.`);
    else if (i.code === "EMPTY") lines.push(`- ${d} is empty. Write it.`);
    else if (i.code === "TOO_SHORT") lines.push(`- ${d} is too short to be useful. Make it concrete.`);
  }
  return lines.join("\n");
}

export const JSON_REPAIR_MESSAGE =
  'Your reply was not the JSON object I need. Reply again with ONLY {"x_post": "...", "linkedin_post": "...", "changelog_md": "..."} — no prose, no code fences.';

/** @param {string} text */
export const userText = (text) => ({ role: "user", content: { type: "text", text } });
/** @param {string} text */
export const assistantText = (text) => ({ role: "assistant", content: { type: "text", text } });
