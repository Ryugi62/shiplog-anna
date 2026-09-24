// Adapter helper: the Anna SDK (v0.16.1, measured) resolves RPCs to the result and throws
// Error{code}. Older docs describe an {ok, result | error} envelope — accept both.

export class AppError extends Error {
  /** @param {string} code @param {string} [message] @param {unknown} [cause] */
  constructor(code, message, cause) {
    super(message ? `${code}: ${message}` : code);
    this.code = code;
    this.cause = cause;
  }
}

/** @param {any} res */
export function unwrap(res) {
  if (res && typeof res === "object" && typeof res.ok === "boolean" && ("result" in res || "error" in res)) {
    if (res.ok) return res.result;
    const err = new Error(res.error?.message ?? "RPC error");
    err.code = res.error?.code;
    err.details = res.error?.details;
    throw err;
  }
  return res;
}
