import { describe, it, expect } from "vitest";
import { listHistory, deleteEntry } from "../../bundle/src/application/history.js";
import { importRecentCommits } from "../../bundle/src/application/import-commits.js";
import { parseRepoRef } from "../../bundle/src/domain/repo.js";

const clock = { now: () => new Date("2026-09-24T03:00:00Z") };

describe("listHistory (UC-2)", () => {
  it("returns newest first with the weekly streak", async () => {
    const entries = [
      { id: "a", createdAt: "2026-09-09T10:00:00Z" },
      { id: "c", createdAt: "2026-09-23T10:00:00Z" },
      { id: "b", createdAt: "2026-09-16T10:00:00Z" },
    ];
    const store = { list: async () => entries };
    const res = await listHistory({ store, clock });
    expect(res.entries.map((e) => e.id)).toEqual(["c", "b", "a"]);
    expect(res.streak).toBe(3);
  });

  it("returns an empty history when the store fails", async () => {
    const store = { list: async () => { throw new Error("down"); } };
    const res = await listHistory({ store, clock });
    expect(res).toEqual({ entries: [], streak: 0, error: true });
  });
});

describe("deleteEntry (UC-4)", () => {
  it("removes by id", async () => {
    const removed = [];
    await deleteEntry("x1", { store: { remove: async (id) => removed.push(id) } });
    expect(removed).toEqual(["x1"]);
  });
});

describe("parseRepoRef", () => {
  it("accepts owner/repo, github URLs, .git and trailing paths", () => {
    expect(parseRepoRef("vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseRepoRef("https://github.com/vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseRepoRef("https://github.com/vercel/next.js.git")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseRepoRef("github.com/vercel/next.js/tree/canary")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseRepoRef("  git@github.com:vercel/next.js.git ")).toEqual({ owner: "vercel", repo: "next.js" });
  });
  it("rejects anything else", () => {
    for (const bad of ["", "vercel", "https://gitlab.com/a/b", "a/b/c/../d", "a b/c"]) {
      expect(() => parseRepoRef(bad)).toThrow(/INVALID_REPO/);
    }
  });
});

describe("importRecentCommits (UC-3)", () => {
  it("asks the source for commits since N days ago and returns them as notes", async () => {
    const seen = [];
    const commits = {
      recentCommits: async (ref, since) => {
        seen.push({ ref, since });
        return ["a1b2c3d feat: add export", "b2c3d4e fix: crash"];
      },
    };
    const notes = await importRecentCommits({ input: "o/r", days: 7 }, { commits, clock });
    expect(seen[0]).toEqual({ ref: { owner: "o", repo: "r" }, since: "2026-09-17T03:00:00.000Z" });
    expect(notes).toBe("a1b2c3d feat: add export\nb2c3d4e fix: crash");
  });
  it("fails with NO_RECENT_COMMITS on an empty week", async () => {
    const commits = { recentCommits: async () => [] };
    await expect(importRecentCommits({ input: "o/r", days: 7 }, { commits, clock })).rejects.toMatchObject({ code: "NO_RECENT_COMMITS" });
  });
});
