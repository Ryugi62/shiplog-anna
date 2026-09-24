// Application: UC-1 generateShipLog — digest → draft → check → (≤1 repair) → fit X → save.
import { digestNotes } from "../domain/digest.js";
import { parseDraftSet, fitXPost, DomainError } from "../domain/drafts.js";
import { checkDrafts } from "../domain/check.js";
import { createEntry } from "../domain/entry.js";
import {
  buildSystemPrompt, buildDigestMessage, buildRepairMessage, JSON_REPAIR_MESSAGE,
  userText, assistantText, MAX_TOKENS, TEMPERATURE,
} from "./prompts.js";

export const MAX_CALLS = 2;

/**
 * Ports:
 *  llm   { complete({systemPrompt, messages, maxTokens, temperature}) → Promise<string> }
 *  store { save(entry) → Promise<void> }
 *  clock { now() → Date }   ids { next() → string }
 *
 * @param {{notes: string, tone: string, language: string, projectName?: string, onProgress?: (p: {step: string, digest?: object}) => void}} input
 * @param {{llm: any, store: any, clock: any, ids: any}} deps
 */
export async function generateShipLog(input, { llm, store, clock, ids }) {
  const progress = typeof input.onProgress === "function" ? input.onProgress : () => {};
  const options = { tone: input.tone, language: input.language, projectName: input.projectName ?? "" };

  const digest = digestNotes(input.notes);
  progress({ step: "read", digest });
  if (!digest.isUsable) throw new DomainError("EMPTY_NOTES");

  const systemPrompt = buildSystemPrompt(options);
  const messages = [userText(buildDigestMessage(digest, options))];
  const ask = (msgs) => llm.complete({ systemPrompt, messages: msgs, maxTokens: MAX_TOKENS, temperature: TEMPERATURE });

  progress({ step: "draft" });
  let calls = 0;
  let reply = await ask(messages);
  calls += 1;

  let drafts;
  try {
    drafts = parseDraftSet(reply);
  } catch (e) {
    if (e.code !== "BAD_MODEL_OUTPUT") throw e;
    const retry = [...messages, assistantText(reply), userText(JSON_REPAIR_MESSAGE)];
    reply = await ask(retry);
    calls += 1;
    drafts = parseDraftSet(reply); // throws BAD_MODEL_OUTPUT if still unusable
  }

  progress({ step: "check" });
  let check = checkDrafts(drafts, digest);
  if (!check.ok && calls < MAX_CALLS) {
    const repair = [...messages, assistantText(reply), userText(buildRepairMessage(check.issues))];
    try {
      const repaired = parseDraftSet(await ask(repair));
      const recheck = checkDrafts(repaired, digest);
      if (recheck.issues.length <= check.issues.length) {
        drafts = repaired;
        check = recheck;
      }
    } catch (e) {
      if (e.code !== "BAD_MODEL_OUTPUT") throw e;
    } finally {
      calls += 1;
    }
  }

  const fitted = fitXPost(drafts.xPost);
  if (fitted.trimmed) {
    drafts = { ...drafts, xPost: fitted.text };
    check = checkDrafts(drafts, digest);
  }

  const entry = createEntry({ id: ids.next(), now: clock.now(), options, digest, drafts, check, notes: input.notes });
  progress({ step: "save" });
  let saved = true;
  try {
    await store.save(entry);
  } catch {
    saved = false;
  }
  progress({ step: "done" });
  return { entry, digest, check, calls, trimmedX: fitted.trimmed, saved };
}
