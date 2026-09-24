// AC-15: run the real wiring (services → use cases → adapters) against the official Anna test
// harness (@anna-ai/cli/test mountBundle), which applies the production ACL from manifest.ui.host_api.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mountBundle } from "@anna-ai/cli/test";
import { createServices } from "../../bundle/src/infrastructure/services.js";

const manifest = JSON.parse(readFileSync(new URL("../../manifest.json", import.meta.url), "utf8"));

// Same shape as the production SDK: every namespace method is rt.call(ns, method, args).
function sdkShaped(runtime) {
  const ns = (name) => new Proxy({}, { get: (_, method) => (args) => runtime.call(name, String(method), args ?? {}) });
  return { llm: ns("llm"), storage: ns("storage"), chat: ns("chat"), window: ns("window"), on: () => () => {} };
}

const DRAFTS = {
  x_post: "Shipped 2 features this week: CSV export for invoices (#42) and team invites. First load went from 3.8s to 1.2s. v1.4.0 is out.",
  linkedin_post: "This week I shipped 2 features and released v1.4.0.\n\n• Download invoices as CSV (#42)\n• Invite teammates by email\n• First load went from 3.8s to 1.2s\n\nWhat should I build next?",
  changelog_md: "### Added\n- Download invoices as CSV (#42)\n- Invite teammates by email\n\n### Performance\n- First load 3.8s → 1.2s",
};

describe("services under the official Anna harness (AC-15)", () => {
  it("generates, saves, lists and deletes with zero ACL denials", async () => {
    const harness = await mountBundle({
      manifest,
      mocks: {
        "llm.complete": () => ({ role: "assistant", content: { type: "text", text: JSON.stringify(DRAFTS) }, model: "mock", stopReason: "endTurn" }),
        "chat.append_artifact": () => ({ artifact_id: "app-test" }),
      },
    });
    const services = createServices(sdkShaped(harness.runtime), { clock: { now: () => new Date("2026-09-24T03:00:00Z") } });
    const notes = [
      "3f9c2e1 feat(export): download invoices as CSV (#42)",
      "8a1d4b7 feat: invite teammates by email",
      "1b6f3a2 perf(dashboard): first load 3.8s -> 1.2s",
      "a8d2c55 release v1.4.0",
    ].join("\n");

    const res = await services.generate({ notes, tone: "build-in-public", language: "en", projectName: "Invoicer" }, () => {});
    expect(res.check.ok).toBe(true);
    expect(res.saved).toBe(true);
    services.afterRun(res);
    await harness.wait(5);

    const hist = await services.listHistory();
    expect(hist.entries).toHaveLength(1);
    expect(hist.entries[0].drafts.xPost).toBe(DRAFTS.x_post);
    expect(hist.streak).toBe(1);

    await services.setPrefs({ tone: "technical", language: "ko" });
    expect(await services.getPrefs()).toEqual({ tone: "technical", language: "ko" });

    await services.deleteEntry(hist.entries[0].id);
    expect((await services.listHistory()).entries).toHaveLength(0);

    const all = harness.calls.all();
    expect(all.filter((c) => c.outcome === "denied")).toEqual([]);
    const used = new Set(all.map((c) => `${c.ns}.${c.method}`));
    for (const m of ["llm.complete", "storage.set", "storage.list", "storage.get", "storage.delete", "chat.append_artifact", "window.set_title"]) {
      expect(used.has(m)).toBe(true);
    }
    expect(harness.calls.byNs("llm.complete")).toHaveLength(1);
  });

  it("the harness denies a namespace the manifest does not grant (control)", async () => {
    const harness = await mountBundle({ manifest });
    await expect(harness.runtime.call("fs", "read", { path: "/etc/passwd" })).rejects.toBeTruthy();
    expect(harness.calls.last()?.outcome).toBe("denied");
  });
});
