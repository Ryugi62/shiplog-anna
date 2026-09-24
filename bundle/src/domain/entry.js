// Domain: ShipEntry (one saved run) and the weekly streak.

/** @param {Date} date → "YYYY-Www" (ISO-8601, UTC) */
export function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday 00:00 UTC of the ISO week containing `date`. */
function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

/**
 * Consecutive ISO weeks with ≥1 entry, ending this week or last week.
 * @param {{createdAt: string}[]} entries
 * @param {Date} now
 */
export function weeklyStreak(entries, now) {
  const weeks = new Set(entries.map((e) => isoWeekKey(new Date(e.createdAt))));
  let cursor = weekStart(now);
  if (!weeks.has(isoWeekKey(cursor))) cursor = new Date(cursor.getTime() - 7 * 86400000);
  let streak = 0;
  while (weeks.has(isoWeekKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 7 * 86400000);
  }
  return streak;
}

export const ENTRY_NOTES_MAX = 3000;
export const ENTRY_NUMBERS_MAX = 300;

/**
 * @param {{id: string, now: Date, options: {tone: string, language: string, projectName?: string},
 *   digest: {changeCount: number, shippedCount: number, noiseCount: number, counts: Record<string, number>, versions: string[], knownNumbers?: Set<string>},
 *   drafts: import("./drafts.js").DraftSet, check: import("./check.js").DraftCheck, notes?: string}} input
 */
export function createEntry({ id, now, options, digest, drafts, check, notes }) {
  return {
    id,
    createdAt: now.toISOString(),
    week: isoWeekKey(now),
    options: { tone: options.tone, language: options.language, projectName: options.projectName ?? "" },
    summary: {
      changeCount: digest.changeCount,
      shippedCount: digest.shippedCount,
      noiseCount: digest.noiseCount,
      counts: { ...digest.counts },
      versions: [...(digest.versions ?? [])],
    },
    drafts: { ...drafts },
    issues: check.issues.map((i) => ({ ...i })),
    knownNumbers: [...(digest.knownNumbers ?? [])].slice(0, ENTRY_NUMBERS_MAX),
    notes: typeof notes === "string" ? notes.slice(0, ENTRY_NOTES_MAX) : "",
  };
}
