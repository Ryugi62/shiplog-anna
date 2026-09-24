// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountApp } from "../../bundle/src/adapters/ui/view.js";
import { SAMPLE_NOTES } from "../../bundle/src/adapters/ui/copy.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

function entry(overrides = {}) {
  return {
    id: "20260924T030000-aa",
    createdAt: "2026-09-24T03:00:00.000Z",
    options: { tone: "build-in-public", language: "en", projectName: "Invoicer" },
    summary: { changeCount: 9, shippedCount: 6, noiseCount: 3, counts: { feat: 2, fix: 1, perf: 1, docs: 1, release: 1, noise: 3 }, versions: ["v1.4.0"] },
    drafts: { xPost: "Shipped 2 features and v1.4.0. First load 1.2s, not 40% faster.", linkedinPost: "LinkedIn body with 2 features.", changelog: "### Added\n- CSV export (#42)" },
    issues: [{ code: "UNSUPPORTED_NUMBER", draft: "xPost", value: "40" }],
    knownNumbers: ["2", "1.4.0", "1.2", "42"],
    notes: "feat: CSV export (#42)",
    ...overrides,
  };
}

function services(overrides = {}) {
  const log = [];
  return {
    log,
    generate: async (opts, onProgress) => {
      log.push(["generate", opts]);
      onProgress({ step: "read", digest: { changeCount: 9, noiseCount: 3 } });
      onProgress({ step: "draft" });
      onProgress({ step: "check" });
      return { entry: entry(), check: { ok: false } };
    },
    listHistory: async () => ({ entries: [], streak: 0 }),
    importCommits: async (input) => { log.push(["import", input]); return "a1b2c3d feat: imported"; },
    deleteEntry: async () => {},
    getPrefs: async () => ({}),
    setPrefs: async (p) => { log.push(["prefs", p]); },
    copyText: async (t) => { log.push(["copy", t]); return true; },
    afterRun: () => log.push(["afterRun"]),
    ...overrides,
  };
}

describe("ShipLog view", () => {
  let root;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById("app");
  });

  it("starts on the question with the CTA disabled until notes exist", async () => {
    const app = mountApp(root, services(), { language: "ko-KR" });
    await app.ready;
    expect(root.querySelector("#q").textContent).toBe("이번 주에 무엇을 배포했나요?");
    const cta = root.querySelector("#cta");
    expect(cta.disabled).toBe(true);
    const notes = root.querySelector("#notes");
    notes.value = "feat: x\nfix: y";
    notes.dispatchEvent(new Event("input"));
    expect(cta.disabled).toBe(false);
    expect(root.querySelector("#line-count").textContent).toBe("2줄");
    expect(root.querySelector("#lang").value).toBe("ko");
    expect(root.querySelector("meta[name=viewport]")).toBeNull();
  });

  it("runs, shows the number first, marks unknown numbers and copies plain text", async () => {
    const svc = services();
    const app = mountApp(root, svc, {});
    await app.ready;
    const notes = root.querySelector("#notes");
    notes.value = "feat: x";
    notes.dispatchEvent(new Event("input"));
    root.querySelector("#cta").click();
    await flush();
    await flush();
    expect(root.querySelector("#screen-result").hidden).toBe(false);
    expect(root.querySelector("#big-num").textContent).toBe("6");
    expect(root.querySelector("#subline").textContent).toContain("2 features, 1 fix, 1 speed-up");
    expect(root.querySelector("#run-meta").textContent).toContain("Skipped 3 noise lines.");
    expect(root.querySelector("#run-meta").textContent).toContain("Invoicer");
    expect(root.querySelector("#verdict").className).toContain("warn");
    const x = root.querySelector('[data-draft="xPost"]');
    expect([...x.querySelectorAll("mark.num-unknown")].map((m) => m.textContent)).toEqual(["40"]);
    expect([...x.querySelectorAll("mark.num-known")].map((m) => m.textContent)).toEqual(["2", "1.4.0", "1.2"]);
    expect(x.querySelector(".issues").textContent).toContain('"40"');
    x.querySelector("[data-copy]").click();
    await flush();
    expect(svc.log.find((l) => l[0] === "copy")[1]).toBe(entry().drafts.xPost);
    expect(svc.log.some((l) => l[0] === "afterRun")).toBe(true);
    expect(root.querySelector("#cta").textContent).toBe("Rewrite");
    expect(root.querySelector("#edit-btn").hidden).toBe(false);
  });

  it("the sample button fills a sample week and runs it in one click", async () => {
    const svc = services();
    const app = mountApp(root, svc, {});
    await app.ready;
    root.querySelector("#sample-btn").click();
    await flush();
    const call = svc.log.find((l) => l[0] === "generate");
    expect(call[1].notes).toBe(SAMPLE_NOTES);
    expect(call[1].projectName).toBe("Invoicer (sample)");
  });

  it("shows a specific error and keeps the notes when generation fails", async () => {
    const svc = services({ generate: async () => { throw Object.assign(new Error("q"), { code: "QUOTA" }); } });
    const app = mountApp(root, svc, {});
    await app.ready;
    const notes = root.querySelector("#notes");
    notes.value = "feat: keep me";
    notes.dispatchEvent(new Event("input"));
    root.querySelector("#cta").click();
    await flush();
    await flush();
    expect(root.querySelector("#screen-input").hidden).toBe(false);
    expect(root.querySelector("#error").hidden).toBe(false);
    expect(root.querySelector("#error").textContent).toMatch(/quota/i);
    expect(notes.value).toBe("feat: keep me");
  });

  it("imports commits from GitHub into the notes", async () => {
    const svc = services();
    const app = mountApp(root, svc, {});
    await app.ready;
    root.querySelector("#import-toggle").click();
    expect(root.querySelector("#import-panel").hidden).toBe(false);
    root.querySelector("#repo").value = "o/r";
    root.querySelector("#import-btn").click();
    await flush();
    await flush();
    expect(root.querySelector("#notes").value).toBe("a1b2c3d feat: imported");
    expect(svc.log.find((l) => l[0] === "import")[1]).toBe("o/r");
  });

  it("prefills from an Anna entry payload and shows history with the streak", async () => {
    const svc = services({ listHistory: async () => ({ entries: [entry()], streak: 2 }) });
    const app = mountApp(root, svc, { initial: { notes: "feat: from chat", projectName: "Chatty", tone: "technical" } });
    await app.ready;
    expect(root.querySelector("#notes").value).toBe("feat: from chat");
    expect(root.querySelector("#project").value).toBe("Chatty");
    expect(root.querySelector("#tone-technical").checked).toBe(true);
    expect(root.querySelector("#streak").textContent).toBe("2-week streak");
    expect(root.querySelector("#history").hidden).toBe(false);
    root.querySelector(".history-open").click();
    expect(root.querySelector("#screen-result").hidden).toBe(false);
    expect(root.querySelector("#big-num").textContent).toBe("6");
  });

  it("restores saved preferences", async () => {
    const svc = services({ getPrefs: async () => ({ tone: "professional", language: "ja", projectName: "Kept" }) });
    const app = mountApp(root, svc, {});
    await app.ready;
    expect(root.querySelector("#tone-professional").checked).toBe(true);
    expect(root.querySelector("#lang").value).toBe("ja");
    expect(root.querySelector("#project").value).toBe("Kept");
  });
});

describe("ShipLog view — locales and copy fallback", () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; });

  it("renders Simplified Chinese and Korean UIs from the browser language", async () => {
    let root = document.getElementById("app");
    let app = mountApp(root, services(), { language: "zh-CN" });
    await app.ready;
    expect(root.querySelector("#q").textContent).toBe("这周你发布了什么？");
    expect(root.querySelector("#cta").textContent).toBe("写出 3 篇草稿");
    expect(root.querySelector("#lang").value).toBe("zh-CN");
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById("app");
    app = mountApp(root, services(), { language: "ko-KR" });
    await app.ready;
    expect(root.querySelector("#q").textContent).toBe("이번 주에 무엇을 배포했나요?");
    expect(root.querySelector("#tone-build-in-public").nextSibling.textContent).toBe("빌드 인 퍼블릭");
  });

  it("selects the draft text when the clipboard is blocked", async () => {
    const root = document.getElementById("app");
    const svc = services({ copyText: async () => false });
    const app = mountApp(root, svc, {});
    await app.ready;
    const notes = root.querySelector("#notes");
    notes.value = "feat: x";
    notes.dispatchEvent(new Event("input"));
    root.querySelector("#cta").click();
    await flush();
    await flush();
    const btn = root.querySelector('[data-draft="linkedinPost"] [data-copy]');
    btn.click();
    await flush();
    expect(btn.textContent).toBe("Selected. Press Ctrl+C");
    expect(document.getSelection().toString()).toBe(entry().drafts.linkedinPost);
  });
});
