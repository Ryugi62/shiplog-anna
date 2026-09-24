import { describe, it, expect } from "vitest";
import { parseChanges } from "../../bundle/src/domain/changes.js";

describe("parseChanges (AC-1..AC-3)", () => {
  it("AC-1 parses git log --oneline with conventional prefixes, scopes, PR refs and strips SHAs", () => {
    const notes = [
      "a1b2c3d feat(export): add CSV export for invoices (#42)",
      "9f8e7d6 fix: crash when the cart is empty",
      "0badc0d perf(api)!: cache user lookups",
    ].join("\n");
    const changes = parseChanges(notes);
    expect(changes).toHaveLength(3);
    expect(changes[0]).toMatchObject({ kind: "feat", scope: "export", subject: "add CSV export for invoices", ref: "#42" });
    expect(changes[1]).toMatchObject({ kind: "fix", scope: null, subject: "crash when the cart is empty" });
    expect(changes[2]).toMatchObject({ kind: "perf", scope: "api", breaking: true });
  });

  it("AC-1 reads full `git log` output (commit/Author/Date headers, indented messages)", () => {
    const notes = [
      "commit 3f2c1a9e8d7b6c5a4f3e2d1c0b9a8f7e6d5c4b3a",
      "Author: Dev <dev@example.com>",
      "Date:   Mon Sep 21 10:00:00 2026 +0900",
      "",
      "    feat: onboarding checklist",
      "",
      "commit 1111111111111111111111111111111111111111",
      "Merge: abc def",
      "Author: Dev <dev@example.com>",
      "Date:   Tue Sep 22 10:00:00 2026 +0900",
      "",
      "    Merge pull request #7 from dev/branch",
    ].join("\n");
    const changes = parseChanges(notes);
    expect(changes.map((c) => c.kind)).toEqual(["feat", "noise"]);
    expect(changes[0].subject).toBe("onboarding checklist");
  });

  it("AC-2 marks merges, dependency bumps, typos, wip and formatting as noise", () => {
    const notes = [
      "Merge branch 'main' into dev",
      "chore(deps): bump vite from 5.0.0 to 5.1.0",
      "Bump lodash from 4.17.20 to 4.17.21",
      "fix typo in README",
      "wip",
      "style: run prettier",
      "chore: lint",
    ].join("\n");
    const kinds = parseChanges(notes).map((c) => c.kind);
    expect(kinds.every((k) => k === "noise")).toBe(true);
  });

  it("AC-3 infers kinds from free-form bullets", () => {
    const notes = [
      "- Added dark mode to the settings page",
      "* Fixed login loop on Safari",
      "• Search is now 2x faster",
      "1. Refactored the billing module",
      "- Updated README with setup steps",
      "- Released v1.4.0",
      "- Talked to three users about pricing",
    ].join("\n");
    const kinds = parseChanges(notes).map((c) => c.kind);
    expect(kinds).toEqual(["feat", "fix", "perf", "refactor", "docs", "release", "other"]);
    expect(parseChanges(notes)[0].subject).toBe("Added dark mode to the settings page");
  });

  it("ignores blank lines and returns [] for empty input", () => {
    expect(parseChanges("")).toEqual([]);
    expect(parseChanges("\n\n   \n")).toEqual([]);
    expect(parseChanges(undefined)).toEqual([]);
  });
});
