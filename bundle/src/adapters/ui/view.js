// UI adapter: the ShipLog screen. DOM only — every capability arrives through `services`.
import {
  messages, uiLocale, errorText, issueText, LANGUAGE_LABELS, SAMPLE_NOTES, SAMPLE_PROJECT,
  countsLine, shortDate, defaultLanguage,
} from "./copy.js";
import { segmentNumbers } from "./highlight.js";
import { weightedLength, X_LIMIT } from "../../domain/drafts.js";

const DRAFT_KEYS = ["xPost", "linkedinPost", "changelog"];
const STEPS = ["read", "draft", "check", "save"];
const TONES = ["build-in-public", "professional", "technical"];
const GIT_COMMAND = 'git log --since="1 week ago" --oneline';

/** Tiny element helper. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   generate: (opts: object, onProgress: Function) => Promise<any>,
 *   listHistory: () => Promise<{entries: any[], streak: number}>,
 *   importCommits: (input: string) => Promise<string>,
 *   deleteEntry: (id: string) => Promise<void>,
 *   getPrefs: () => Promise<object>, setPrefs: (p: object) => Promise<void>,
 *   copyText: (text: string) => Promise<boolean>,
 *   afterRun?: (result: any) => void,
 * }} services
 * @param {{language?: string, initial?: {notes?: string, tone?: string, language?: string, projectName?: string}, notice?: string}} env
 */
export function mountApp(root, services, env = {}) {
  const locale = uiLocale(env.language);
  const M = messages(locale);
  const dateLocale = locale === "en" ? undefined : locale;
  const state = { tone: "build-in-public", language: defaultLanguage(env.language), busy: false, lastRun: null };
  document.documentElement.lang = locale;

  // ---------- input screen ----------
  const notes = h("textarea", {
    id: "notes", rows: "9", spellcheck: "false",
    placeholder: "a1b2c3d feat: add CSV export (#42)\n- Fixed the login loop on Safari\n- Dashboard loads in 1.2s now",
    "aria-describedby": "notes-hint",
  });
  const lineCount = h("span", { class: "meta", id: "line-count", "aria-live": "polite" });
  const repo = h("input", { id: "repo", type: "text", inputmode: "url", autocomplete: "off", placeholder: "owner/repo" });
  const importBtn = h("button", { type: "button", class: "btn btn-secondary", id: "import-btn", text: M.importBtn });
  const copyCmd = h("button", { type: "button", class: "link", id: "copy-cmd", text: M.copyCommand });
  const importPanel = h("div", { class: "import", id: "import-panel", hidden: true },
    h("label", { for: "repo", text: M.repoLabel }),
    h("div", { class: "row" }, repo, importBtn),
    h("p", { class: "meta" }, M.privateBefore, h("code", { text: GIT_COMMAND }), M.privateAfter, copyCmd),
  );
  const importToggle = h("button", { type: "button", class: "chip", id: "import-toggle", "aria-expanded": "false", "aria-controls": "import-panel", text: M.importToggle });
  const sampleBtn = h("button", { type: "button", class: "chip", id: "sample-btn", text: M.sample });
  const project = h("input", { id: "project", type: "text", maxlength: "60", autocomplete: "off", placeholder: M.projectPlaceholder });
  const toneInputs = TONES.map((value) => {
    const input = h("input", { type: "radio", name: "tone", value, id: `tone-${value}` });
    return { value, input, el: h("label", { class: "pill", for: `tone-${value}` }, input, h("span", { text: M.tones[value] })) };
  });
  const lang = h("select", { id: "lang" }, ...Object.entries(LANGUAGE_LABELS).map(([v, l]) => h("option", { value: v, text: l })));
  const historyList = h("ul", { class: "history-list", id: "history-list" });
  const historyCount = h("span", { class: "meta" });
  const history = h("details", { class: "history", id: "history", hidden: true }, h("summary", {}, `${M.pastWeeks} `, historyCount), historyList);
  const streak = h("span", { class: "streak", id: "streak", hidden: true });
  const notice = h("p", { class: "notice", id: "notice", hidden: !env.notice, text: env.notice ? M.preview : "" });
  const errorBox = h("p", { class: "error", id: "error", role: "alert", hidden: true });

  const inputScreen = h("section", { class: "screen", id: "screen-input", "aria-labelledby": "q" },
    h("div", { class: "block" },
      h("h2", { id: "q", class: "title", text: M.question }),
      h("p", { class: "lead", id: "notes-hint", text: M.lead }),
      h("label", { for: "notes", class: "sr-only", text: M.notesLabel }),
      notes,
      h("div", { class: "under" }, lineCount),
      h("div", { class: "chips" }, sampleBtn, importToggle),
      importPanel,
    ),
    h("div", { class: "block options" },
      h("div", { class: "field" }, h("label", { for: "project" }, `${M.projectLabel} `, h("span", { class: "meta", text: M.optional })), project),
      h("fieldset", { class: "field" }, h("legend", { text: M.toneLabel }), h("div", { class: "pills" }, ...toneInputs.map((t) => t.el))),
      h("div", { class: "field" }, h("label", { for: "lang", text: M.langLabel }), lang),
    ),
    history,
  );

  // ---------- loading screen ----------
  const stepItems = Object.fromEntries(STEPS.map((s) => [s, h("li", { class: "step", "data-state": "pending", text: M.steps[s]({ changeCount: 0, noiseCount: 0 }) })]));
  const loadingScreen = h("section", { class: "screen", id: "screen-loading", hidden: true, "aria-live": "polite", "aria-busy": "true" },
    h("h2", { class: "title", text: M.loadingTitle }),
    h("ol", { class: "steps" }, ...STEPS.map((s) => stepItems[s])),
    h("div", { class: "skeletons", "aria-hidden": "true" }, ...DRAFT_KEYS.map(() => h("div", { class: "skeleton" }, h("i"), h("i"), h("i")))),
  );

  // ---------- result screen ----------
  const bigNum = h("strong", { class: "big-num", id: "big-num" });
  const headlineRest = h("span", { id: "headline-rest" });
  const headline = h("p", { class: "headline" }, bigNum, headlineRest);
  const subline = h("p", { id: "subline" });
  const runMeta = h("p", { class: "meta", id: "run-meta" });
  const verdict = h("p", { class: "verdict", id: "verdict" });
  const cards = h("div", { class: "cards" });
  const digestList = h("ul", { id: "digest-list" });
  const digestBox = h("details", { class: "digest", id: "digest" }, h("summary", { text: M.digestTitle }), digestList);
  const resultScreen = h("section", { class: "screen", id: "screen-result", hidden: true, "aria-labelledby": "big-num" },
    headline, subline, runMeta, verdict, cards, digestBox,
  );

  // ---------- bottom bar ----------
  const cta = h("button", { type: "button", class: "btn btn-primary", id: "cta", text: M.cta });
  const editBtn = h("button", { type: "button", class: "btn btn-secondary", id: "edit-btn", hidden: true, text: M.edit });
  const bar = h("div", { class: "bar" }, h("div", { class: "bar-inner" }, editBtn, cta));

  root.replaceChildren(
    h("header", { class: "top" }, h("h1", { class: "brand", text: "ShipLog" }), streak),
    h("main", { class: "main" }, notice, inputScreen, loadingScreen, resultScreen, errorBox),
    bar,
  );

  // ---------- behaviour ----------
  function setTone(value) {
    state.tone = TONES.includes(value) ? value : "build-in-public";
    for (const t of toneInputs) t.input.checked = t.value === state.tone;
  }
  function setLanguage(value) {
    state.language = LANGUAGE_LABELS[value] ? value : "en";
    lang.value = state.language;
  }
  const screens = { input: inputScreen, loading: loadingScreen, result: resultScreen };
  const screenIs = (name) => !screens[name].hidden;
  function updateLineCount() {
    const n = notes.value.split(/\r?\n/).filter((l) => l.trim()).length;
    lineCount.textContent = n === 0 ? "" : M.lines(n);
    if (!state.busy && screenIs("input")) cta.disabled = n === 0;
  }
  function show(name) {
    for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
    editBtn.hidden = name !== "result";
    cta.textContent = name === "result" ? M.rewrite : M.cta;
    cta.disabled = name === "loading";
    if (name === "input") updateLineCount();
  }
  function showError(err) {
    errorBox.textContent = errorText(err, locale);
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }
  function flash(button, text, restore) {
    button.textContent = text;
    setTimeout(() => (button.textContent = restore), 1600);
  }

  function setStep(step, digest) {
    const idx = STEPS.indexOf(step);
    STEPS.forEach((s, i) => {
      stepItems[s].dataset.state = step === "done" || i < idx ? "done" : i === idx ? "active" : "pending";
    });
    if (step === "read" && digest) stepItems.read.textContent = M.steps.read(digest);
  }

  function renderDraftBody(text, known) {
    const body = h("div", { class: "draft-body" });
    for (const seg of segmentNumbers(text, known)) {
      if (seg.kind === "plain") body.append(seg.text);
      else body.append(h("mark", { class: `num num-${seg.kind}`, title: seg.kind === "known" ? M.markKnown : M.markUnknown, text: seg.text }));
    }
    return body;
  }

  function selectContents(el) {
    try {
      const sel = el.ownerDocument.getSelection();
      sel.removeAllRanges();
      const range = el.ownerDocument.createRange();
      range.selectNodeContents(el);
      sel.addRange(range);
    } catch {
      // selection is a convenience only
    }
  }

  function renderResult(entry) {
    const known = new Set(entry.knownNumbers ?? []);
    const s = entry.summary ?? {};
    const n = s.shippedCount ?? 0;
    bigNum.textContent = String(n);
    headlineRest.textContent = M.headlineRest(n);
    subline.textContent = countsLine(s.counts, locale);
    const meta = [entry.options?.projectName, entry.createdAt ? shortDate(entry.createdAt, dateLocale) : ""].filter(Boolean).join(", ");
    runMeta.textContent = [meta ? `${meta}.` : "", s.noiseCount ? M.skipped(s.noiseCount) : ""].filter(Boolean).join(" ");
    const issues = entry.issues ?? [];
    const unknown = issues.filter((i) => i.code === "UNSUPPORTED_NUMBER");
    if (issues.length === 0) {
      verdict.className = "verdict ok";
      verdict.textContent = M.verdictOk;
    } else {
      verdict.className = "verdict warn";
      verdict.textContent = unknown.length > 0 ? M.verdictUnknown(unknown.length) : M.verdictOther;
    }
    cards.replaceChildren(...DRAFT_KEYS.map((key) => {
      const text = entry.drafts?.[key] ?? "";
      const body = renderDraftBody(text, known);
      const copyBtn = h("button", { type: "button", class: "btn btn-small", "data-copy": key, text: M.copy });
      copyBtn.addEventListener("click", async () => {
        const ok = await services.copyText(text);
        if (!ok) selectContents(body);
        flash(copyBtn, ok ? M.copied : M.copySelected, M.copy);
      });
      const count = key === "xPost" ? h("span", { class: "meta count", text: `${weightedLength(text)}/${X_LIMIT}` }) : null;
      const own = issues.filter((i) => i.draft === key);
      return h("article", { class: "card", "data-draft": key },
        h("div", { class: "card-head" }, h("h3", { text: M.drafts[key] }), count, copyBtn),
        body,
        own.length ? h("ul", { class: "issues" }, ...own.map((i) => h("li", { text: issueText(i, locale) }))) : null,
      );
    }));
    const lines = (entry.notes ?? "").split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
    digestList.replaceChildren(...lines.map((l) => h("li", { text: l })));
    digestBox.open = false;
  }

  async function refreshHistory() {
    const { entries, streak: weeks } = await services.listHistory();
    streak.hidden = !weeks;
    streak.textContent = weeks ? M.streak(weeks) : "";
    history.hidden = entries.length === 0;
    historyCount.textContent = entries.length ? `(${entries.length})` : "";
    historyList.replaceChildren(...entries.map((e) => {
      const open = h("button", { type: "button", class: "history-open" },
        h("span", { class: "history-date", text: shortDate(e.createdAt, dateLocale) }),
        h("span", { class: "history-text", text: M.historyRow(e.summary?.shippedCount ?? 0, e.options?.projectName) }),
      );
      open.addEventListener("click", () => {
        clearError();
        state.lastRun = { notes: e.notes ?? "", projectName: e.options?.projectName ?? "", tone: e.options?.tone ?? state.tone, language: e.options?.language ?? state.language };
        renderResult(e);
        show("result");
      });
      const del = h("button", { type: "button", class: "btn btn-small btn-quiet", "aria-label": `${M.delete} ${shortDate(e.createdAt, dateLocale)}`, text: M.delete });
      del.addEventListener("click", async () => {
        await services.deleteEntry(e.id).catch(() => {});
        await refreshHistory().catch(() => {});
      });
      return h("li", {}, open, del);
    }));
  }

  async function run(input) {
    if (state.busy) return;
    clearError();
    state.busy = true;
    state.lastRun = input;
    setStep("read");
    show("loading");
    try {
      const result = await services.generate(input, (p) => setStep(p.step, p.digest));
      renderResult(result.entry);
      show("result");
      services.afterRun?.(result);
      services.setPrefs({ tone: input.tone, language: input.language, projectName: input.projectName }).catch(() => {});
      refreshHistory().catch(() => {});
    } catch (err) {
      if (typeof input.notes === "string") notes.value = input.notes;
      if (typeof input.projectName === "string") project.value = input.projectName;
      show("input");
      showError(err);
    } finally {
      state.busy = false;
      if (screenIs("input")) updateLineCount();
      else cta.disabled = false;
    }
  }

  const currentInput = () => ({ notes: notes.value, projectName: project.value.trim(), tone: state.tone, language: state.language });

  cta.addEventListener("click", () => {
    if (screenIs("result") && state.lastRun) run({ ...state.lastRun });
    else run(currentInput());
  });
  editBtn.addEventListener("click", () => {
    if (state.lastRun) {
      notes.value = state.lastRun.notes ?? notes.value;
      project.value = state.lastRun.projectName ?? project.value;
    }
    show("input");
    notes.focus();
  });
  notes.addEventListener("input", updateLineCount);
  notes.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && !cta.disabled) cta.click();
  });
  sampleBtn.addEventListener("click", () => {
    notes.value = SAMPLE_NOTES;
    project.value = SAMPLE_PROJECT;
    updateLineCount();
    run(currentInput());
  });
  importToggle.addEventListener("click", () => {
    const open = importPanel.hidden;
    importPanel.hidden = !open;
    importToggle.setAttribute("aria-expanded", String(open));
    if (open) repo.focus();
  });
  importBtn.addEventListener("click", async () => {
    clearError();
    importBtn.disabled = true;
    importBtn.textContent = M.importing;
    try {
      notes.value = await services.importCommits(repo.value);
      updateLineCount();
      importPanel.hidden = true;
      importToggle.setAttribute("aria-expanded", "false");
      notes.focus();
    } catch (err) {
      showError(err);
    } finally {
      importBtn.disabled = false;
      importBtn.textContent = M.importBtn;
    }
  });
  copyCmd.addEventListener("click", async () => {
    const ok = await services.copyText(GIT_COMMAND);
    flash(copyCmd, ok ? M.copied : M.copySelected, M.copyCommand);
  });
  for (const t of toneInputs) t.input.addEventListener("change", () => setTone(t.value));
  lang.addEventListener("change", () => setLanguage(lang.value));

  // ---------- boot ----------
  setTone(state.tone);
  setLanguage(state.language);
  show("input");

  function applyInitial(initial) {
    if (!initial || typeof initial !== "object") return;
    if (typeof initial.notes === "string" && initial.notes.trim()) notes.value = initial.notes;
    if (typeof initial.projectName === "string") project.value = initial.projectName;
    if (initial.tone) setTone(initial.tone);
    if (initial.language) setLanguage(initial.language);
    if (!state.busy) show("input");
  }

  const ready = (async () => {
    const prefs = await services.getPrefs().catch(() => ({}));
    if (prefs.tone) setTone(prefs.tone);
    if (prefs.language) setLanguage(prefs.language);
    if (prefs.projectName && !project.value) project.value = prefs.projectName;
    applyInitial(env.initial);
    await refreshHistory().catch(() => {});
  })();

  return { ready, applyInitial, run: () => cta.click() };
}
