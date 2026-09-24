import { describe, it, expect } from "vitest";
import { generateShipLog } from "../../bundle/src/application/generate.js";

const NOTES = [
  "a1b2c3d feat(export): add CSV export for invoices (#42)",
  "b2c3d4e feat: team invites",
  "c3d4e5f fix: crash when the cart is empty",
  "d4e5f6a perf: dashboard loads in 1.2s instead of 3.8s",
  "e5f6a7b chore(deps): bump vite from 5.0.0 to 5.1.0",
].join("\n");

const GOOD = {
  x_post: "Shipped 2 features this week: CSV export for invoices (#42) and team invites. Also fixed an empty-cart crash, and the dashboard now loads in 1.2s instead of 3.8s. #buildinpublic",
  linkedin_post: "This week on Invoicer I shipped 2 features and 1 fix.\n\n• CSV export for invoices (#42)\n• Team invites\n• The dashboard now loads in 1.2s instead of 3.8s\n\nWhat would you like to see next?",
  changelog_md: "### Added\n- CSV export for invoices (#42)\n- Team invites\n\n### Fixed\n- Crash when the cart is empty\n\n### Performance\n- Dashboard loads in 1.2s (was 3.8s)",
};

function fakeLlm(replies) {
  const calls = [];
  return {
    calls,
    async complete(req) {
      calls.push(req);
      const next = replies[calls.length - 1];
      if (next instanceof Error) throw next;
      return typeof next === "string" ? next : JSON.stringify(next);
    },
  };
}

function fakeStore({ fail = false } = {}) {
  const saved = [];
  return {
    saved,
    async save(entry) {
      if (fail) throw new Error("storage down");
      saved.push(entry);
    },
    async list() {
      return saved;
    },
    async remove() {},
  };
}

const deps = (llm, store = fakeStore()) => ({
  llm,
  store,
  clock: { now: () => new Date("2026-09-24T03:00:00Z") },
  ids: { next: () => "20260924T030000-test" },
});

const OPTS = { notes: NOTES, tone: "build-in-public", language: "en", projectName: "Invoicer" };

describe("generateShipLog (UC-1)", () => {
  it("returns checked drafts in one LLM call when the first reply is clean, and saves the entry", async () => {
    const llm = fakeLlm([GOOD]);
    const store = fakeStore();
    const res = await generateShipLog(OPTS, deps(llm, store));
    expect(llm.calls).toHaveLength(1);
    expect(res.check.ok).toBe(true);
    expect(res.entry.drafts.xPost).toBe(GOOD.x_post);
    expect(res.saved).toBe(true);
    expect(store.saved).toHaveLength(1);
    expect(res.digest.shippedCount).toBe(4);
  });

  it("sends the digest (not raw SHAs) and the rules to the model", async () => {
    const llm = fakeLlm([GOOD]);
    await generateShipLog(OPTS, deps(llm));
    const req = llm.calls[0];
    expect(req.systemPrompt).toMatch(/Use ONLY the facts/);
    expect(req.systemPrompt).toMatch(/English/);
    const user = req.messages[0].content.text;
    expect(user).toContain("PROJECT: Invoicer");
    expect(user).toContain("[feat] (export) add CSV export for invoices (#42)");
    expect(user).not.toContain("a1b2c3d");
    expect(user).toMatch(/noise skipped: 1/);
    expect(req.maxTokens).toBeLessThanOrEqual(4096);
  });

  it("AC-9 makes exactly one repair call when the first draft states an unsupported number", async () => {
    const bad = { ...GOOD, linkedin_post: GOOD.linkedin_post + " Signups grew 40%." };
    const llm = fakeLlm([bad, GOOD]);
    const res = await generateShipLog(OPTS, deps(llm));
    expect(llm.calls).toHaveLength(2);
    const repairText = llm.calls[1].messages.at(-1).content.text;
    expect(repairText).toContain('"40"');
    expect(res.check.ok).toBe(true);
    expect(res.calls).toBe(2);
  });

  it("AC-9 never exceeds 2 calls: remaining issues are reported, X is trimmed to fit", async () => {
    const longX = { ...GOOD, x_post: "Shipped CSV export and team invites. ".repeat(12) };
    const llm = fakeLlm([longX, longX]);
    const res = await generateShipLog(OPTS, deps(llm));
    expect(llm.calls).toHaveLength(2);
    expect(res.trimmedX).toBe(true);
    expect(res.entry.drafts.xPost.endsWith("…")).toBe(true);
    expect(res.check.issues.some((i) => i.code === "X_TOO_LONG")).toBe(false);
  });

  it("AC-8/9 recovers from a non-JSON first reply with one repair call", async () => {
    const llm = fakeLlm(["Sorry, here are some ideas...", GOOD]);
    const res = await generateShipLog(OPTS, deps(llm));
    expect(llm.calls).toHaveLength(2);
    expect(res.entry.drafts.changelog).toContain("### Added");
  });

  it("throws BAD_MODEL_OUTPUT after two unusable replies", async () => {
    const llm = fakeLlm(["nope", "still nope"]);
    await expect(generateShipLog(OPTS, deps(llm))).rejects.toMatchObject({ code: "BAD_MODEL_OUTPUT" });
    expect(llm.calls).toHaveLength(2);
  });

  it("AC-10 rejects empty or noise-only notes with zero LLM calls", async () => {
    const llm = fakeLlm([GOOD]);
    await expect(generateShipLog({ ...OPTS, notes: "   " }, deps(llm))).rejects.toMatchObject({ code: "EMPTY_NOTES" });
    await expect(generateShipLog({ ...OPTS, notes: "wip\nMerge branch 'dev'" }, deps(llm))).rejects.toMatchObject({ code: "EMPTY_NOTES" });
    expect(llm.calls).toHaveLength(0);
  });

  it("AC-11 still returns drafts when saving fails", async () => {
    const llm = fakeLlm([GOOD]);
    const res = await generateShipLog(OPTS, deps(llm, fakeStore({ fail: true })));
    expect(res.saved).toBe(false);
    expect(res.entry.drafts.xPost).toBe(GOOD.x_post);
  });

  it("propagates LLM errors (e.g. quota) without saving", async () => {
    const err = Object.assign(new Error("quota"), { code: "QUOTA" });
    const store = fakeStore();
    await expect(generateShipLog(OPTS, deps(fakeLlm([err]), store))).rejects.toMatchObject({ code: "QUOTA" });
    expect(store.saved).toHaveLength(0);
  });

  it("reports progress steps in order", async () => {
    const steps = [];
    await generateShipLog({ ...OPTS, onProgress: (s) => steps.push(s.step) }, deps(fakeLlm([GOOD])));
    expect(steps).toEqual(["read", "draft", "check", "save", "done"]);
  });

  it("uses the requested output language and tone", async () => {
    const llm = fakeLlm([GOOD]);
    await generateShipLog({ ...OPTS, language: "ko", tone: "technical" }, deps(llm));
    expect(llm.calls[0].systemPrompt).toMatch(/Korean/);
    expect(llm.calls[0].systemPrompt).toMatch(/developer-focused/);
  });
});
