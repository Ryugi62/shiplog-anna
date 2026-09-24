// Domain: parse a GitHub repository reference typed by the user.
import { DomainError } from "./drafts.js";

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/**
 * "owner/repo", "https://github.com/owner/repo(.git)(/…)", "github.com/owner/repo", "git@github.com:owner/repo.git"
 * @param {string} input
 * @returns {{owner: string, repo: string}}
 */
export function parseRepoRef(input) {
  let s = String(input ?? "").trim();
  if (!s || /\s/.test(s) || s.includes("..")) throw new DomainError("INVALID_REPO", s);
  s = s.replace(/^git@github\.com:/i, "");
  s = s.replace(/^https?:\/\//i, "");
  if (/^[^/]+\.[^/]+\//.test(s)) {
    if (!/^(www\.)?github\.com\//i.test(s)) throw new DomainError("INVALID_REPO", s);
    s = s.replace(/^(www\.)?github\.com\//i, "");
  }
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) throw new DomainError("INVALID_REPO", s);
  const hadHost = /github\.com/i.test(String(input));
  if (!hadHost && parts.length !== 2) throw new DomainError("INVALID_REPO", s);
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!NAME.test(owner) || !NAME.test(repo)) throw new DomainError("INVALID_REPO", s);
  return { owner, repo };
}
