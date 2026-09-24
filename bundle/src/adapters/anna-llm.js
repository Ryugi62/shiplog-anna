// Adapter: LlmPort over the Anna host LLM (anna.llm.complete). Billing/model = the user's Anna settings.
import { AppError, unwrap } from "./rpc.js";

export const LLM_TIMEOUT_MS = 150000;

/** @param {any} e @returns {AppError} */
export function toAppError(e) {
  const code = String(e?.code ?? "").toLowerCase();
  const msg = String(e?.message ?? "");
  let mapped = "UNKNOWN";
  if (code.includes("quota")) mapped = "QUOTA";
  else if (code.includes("not_granted") || code.includes("permission_denied") || code.includes("not_allowed")) mapped = "NOT_ALLOWED";
  else if (code.includes("timeout") || /timed out/i.test(msg)) mapped = "TIMEOUT";
  else if (code.includes("provider") || code.includes("invalid_request")) mapped = "PROVIDER";
  else if (code.includes("llm_disabled") || code.includes("not_implemented") || code.includes("unavailable")) mapped = "UNAVAILABLE";
  return new AppError(mapped, msg, e);
}

/** @param {{llm: {complete: Function}}} anna */
export function createAnnaLlm(anna, { timeoutMs = LLM_TIMEOUT_MS } = {}) {
  return {
    /** @param {{systemPrompt: string, messages: object[], maxTokens: number, temperature: number}} req */
    async complete(req) {
      let res;
      try {
        res = unwrap(
          await anna.llm.complete(
            { systemPrompt: req.systemPrompt, messages: req.messages, maxTokens: req.maxTokens, temperature: req.temperature, metadata: { app: "shiplog" } },
            { timeoutMs },
          ),
        );
      } catch (e) {
        throw toAppError(e);
      }
      const content = res?.content;
      const text = typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((b) => (typeof b === "string" ? b : b?.text ?? "")).join("")
          : content?.text;
      if (typeof text !== "string" || !text.trim()) throw new AppError("PROVIDER", "empty model reply");
      return text;
    },
  };
}
