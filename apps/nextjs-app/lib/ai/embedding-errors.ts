// Words providers use when they refuse a request field. Mistral, for example, answers
// `{"type":"extra_forbidden","msg":"Extra inputs are not permitted"}` for `dimensions`.
// Kept in step with the job server's copy in apps/job-server/src/jobs/embedding-errors.ts.
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

/**
 * True when the error body of a failed embeddings request says the provider does
 * not accept the optional `dimensions` field, so the caller can retry once without it.
 */
export function isUnsupportedDimensionsParamError(errorBody: string): boolean {
  const text = errorBody.toLowerCase();
  return (
    text.includes("dimension") &&
    REJECTION_KEYWORDS.some((keyword) => text.includes(keyword))
  );
}
