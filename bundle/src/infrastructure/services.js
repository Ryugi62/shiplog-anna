// Infrastructure: wire adapters → use cases for a connected Anna runtime (or a preview without one).
import { generateShipLog } from "../application/generate.js";
import { listHistory, deleteEntry } from "../application/history.js";
import { importRecentCommits } from "../application/import-commits.js";
import { createAnnaLlm } from "../adapters/anna-llm.js";
import { createAnnaStore } from "../adapters/anna-store.js";
import { createMemoryStore } from "../adapters/memory-store.js";
import { createGitHubCommits } from "../adapters/github-commits.js";
import { AppError } from "../adapters/rpc.js";
import { copyText } from "../adapters/ui/clipboard.js";

export const APP_SLUG = "shiplog";

function idFactory(clock) {
  return {
    next() {
      const stamp = clock.now().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
      return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
    },
  };
}

/**
 * @param {any|null} anna  connected AnnaAppRuntime, or null for the standalone preview
 * @param {{fetch?: typeof fetch, clock?: {now: () => Date}}} [env]
 */
export function createServices(anna, env = {}) {
  const clock = env.clock ?? { now: () => new Date() };
  const ids = idFactory(clock);
  const llm = anna
    ? createAnnaLlm(anna)
    : { complete: async () => { throw new AppError("UNAVAILABLE", "no Anna runtime"); } };
  const annaStore = anna ? createAnnaStore(anna) : null;
  const memory = createMemoryStore();
  let storeBroken = !annaStore;
  const store = {
    async save(entry) {
      if (!storeBroken) {
        try { return await annaStore.save(entry); } catch { storeBroken = true; }
      }
      return memory.save(entry);
    },
    async list() {
      if (!storeBroken) {
        try { return await annaStore.list(); } catch { storeBroken = true; }
      }
      return memory.list();
    },
    async remove(id) {
      if (!storeBroken) {
        try { return await annaStore.remove(id); } catch { /* fall back */ }
      }
      return memory.remove(id);
    },
    async getPrefs() {
      if (!storeBroken) {
        try { return await annaStore.getPrefs(); } catch { /* fall back */ }
      }
      return memory.getPrefs();
    },
    async setPrefs(p) {
      if (!storeBroken) {
        try { return await annaStore.setPrefs(p); } catch { /* fall back */ }
      }
      return memory.setPrefs(p);
    },
  };
  const commits = createGitHubCommits(env.fetch ?? ((...a) => globalThis.fetch(...a)));

  return {
    generate: (opts, onProgress) => generateShipLog({ ...opts, onProgress }, { llm, store, clock, ids }),
    listHistory: () => listHistory({ store, clock }),
    importCommits: (input) => importRecentCommits({ input, days: 7 }, { commits, clock }),
    deleteEntry: (id) => deleteEntry(id, { store }),
    getPrefs: () => store.getPrefs(),
    setPrefs: (p) => store.setPrefs(p),
    copyText: (text) => copyText(text),
    afterRun(result) {
      if (!anna) return;
      const e = result.entry;
      const who = e.options?.projectName ? ` for ${e.options.projectName}` : "";
      // Best-effort: a card in the chat so the user can find this week's drafts again.
      Promise.resolve()
        .then(() => anna.window.set_title({ title: `ShipLog: ${e.summary.shippedCount} changes` }))
        .catch(() => {});
      Promise.resolve()
        .then(() => anna.chat.append_artifact({
          artifact: {
            kind: "shiplog.drafts",
            app_slug: APP_SLUG,
            summary: `ShipLog wrote an X post, a LinkedIn post and a changelog${who} from ${e.summary.shippedCount} changes.`,
            payload_ref: `entries/${e.id}`,
          },
        }))
        .catch(() => {});
    },
  };
}
