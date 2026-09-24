// Adapter: CommitSource over the public GitHub REST API, called from the user's browser.
// Unauthenticated → public repos only, GitHub's per-IP rate limit applies.
import { AppError } from "./rpc.js";

export const GITHUB_API = "https://api.github.com";

/** @param {typeof fetch} fetchImpl */
export function createGitHubCommits(fetchImpl) {
  return {
    /** @param {{owner: string, repo: string}} ref @param {string} sinceIso @returns {Promise<string[]>} */
    async recentCommits({ owner, repo }, sinceIso) {
      const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?since=${encodeURIComponent(sinceIso)}&per_page=100`;
      let res;
      try {
        res = await fetchImpl(url, { headers: { Accept: "application/vnd.github+json" }, credentials: "omit" });
      } catch (e) {
        throw new AppError("NETWORK", String(e?.message ?? e), e);
      }
      if (res.status === 404) throw new AppError("NOT_FOUND", `${owner}/${repo}`);
      if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) throw new AppError("RATE_LIMITED");
      if (res.status === 409) throw new AppError("NO_RECENT_COMMITS", "empty repository");
      if (!res.ok) throw new AppError("NETWORK", `HTTP ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body)) throw new AppError("NETWORK", "unexpected response");
      return body
        .map((c) => {
          const sha = String(c?.sha ?? "").slice(0, 7);
          const first = String(c?.commit?.message ?? "").split("\n")[0].trim();
          return first ? `${sha} ${first}` : "";
        })
        .filter(Boolean);
    },
  };
}
