// Words providers use when they refuse a request field. Mistral, for example, answers
// `{"type":"extra_forbidden","msg":"Extra inputs are not permitted"}` for `dimensions`.
const REJECTION_KEYWORDS = [
  "unknown",
  "unsupported",
  "unrecognized",
  "invalid",
  "unexpected",
  "not permitted",
  "not allowed",
  "extra_forbidden",
  "extra inputs",
];

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

// The provider's reason can sit in the message (OpenAI SDK), in the parsed
// body on `error` (OpenAI SDK), or in `response.data` (axios), so read all three.
function collectErrorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return safeStringify(error);

  const parts: string[] = [];
  if (error instanceof Error) parts.push(error.message);
  if ("error" in error && error.error !== undefined) {
    parts.push(safeStringify(error.error));
  }
  if (
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    parts.push(safeStringify(error.response.data));
  }
  if (parts.length === 0) parts.push(safeStringify(error));
  return parts.join("\n");
}

/**
 * True when an embeddings request failed because the provider does not accept the
 * optional `dimensions` field, so the caller can retry once without it.
 */
export function isUnsupportedDimensionsParamError(error: unknown): boolean {
  const text = collectErrorText(error).toLowerCase();
  return (
    text.includes("dimension") &&
    REJECTION_KEYWORDS.some((keyword) => text.includes(keyword))
  );
}
