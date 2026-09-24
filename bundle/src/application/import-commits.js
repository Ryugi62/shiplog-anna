// Application: UC-3 importRecentCommits — public GitHub repo → notes text.
import { parseRepoRef } from "../domain/repo.js";
import { DomainError } from "../domain/drafts.js";

/**
 * @param {{input: string, days?: number}} req
 * @param {{commits: {recentCommits: (ref: {owner: string, repo: string}, sinceIso: string) => Promise<string[]>}, clock: {now: () => Date}}} deps
 */
export async function importRecentCommits({ input, days = 7 }, { commits, clock }) {
  const ref = parseRepoRef(input);
  const since = new Date(clock.now().getTime() - days * 86400000).toISOString();
  const lines = await commits.recentCommits(ref, since);
  if (!lines || lines.length === 0) throw new DomainError("NO_RECENT_COMMITS", `${ref.owner}/${ref.repo}`);
  return lines.join("\n");
}
