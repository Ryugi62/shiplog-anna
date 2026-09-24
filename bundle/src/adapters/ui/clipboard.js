// UI adapter: copy text. The app runs in a sandboxed iframe, where the async Clipboard API
// may be blocked — fall back to a hidden textarea + execCommand("copy").

/** @param {string} text @param {{navigator?: any, document?: Document}} [env] @returns {Promise<boolean>} */
export async function copyText(text, env = globalThis) {
  const nav = env.navigator;
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  const doc = env.document;
  if (!doc) return false;
  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  doc.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = doc.execCommand ? doc.execCommand("copy") : false;
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
