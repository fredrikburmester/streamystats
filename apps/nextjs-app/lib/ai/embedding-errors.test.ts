import { describe, expect, test } from "bun:test";
import { isUnsupportedDimensionsParamError } from "./embedding-errors";

// The body Mistral returns for /v1/embeddings when `dimensions` is sent (issue #607).
const mistralBody = JSON.stringify({
  object: "error",
  message: {
    detail: [
      {
        type: "extra_forbidden",
        loc: ["body", "EmbeddingRequest", "dimensions"],
        msg: "Extra inputs are not permitted",
        input: 1024,
      },
    ],
  },
  type: "invalid_request_error",
  param: null,
  code: null,
});

describe("isUnsupportedDimensionsParamError", () => {
  test("matches the Mistral 422 body", () => {
    expect(isUnsupportedDimensionsParamError(mistralBody)).toBe(true);
  });

  test("matches the older wordings", () => {
    expect(
      isUnsupportedDimensionsParamError(
        '{"error":{"message":"Unrecognized request argument supplied: dimensions"}}',
      ),
    ).toBe(true);
    expect(
      isUnsupportedDimensionsParamError(
        "This model does not support the dimensions parameter: unsupported",
      ),
    ).toBe(true);
  });

  test("ignores rejections that do not mention dimensions", () => {
    expect(
      isUnsupportedDimensionsParamError(
        '{"type":"extra_forbidden","loc":["body","foo"],"msg":"Extra inputs are not permitted"}',
      ),
    ).toBe(false);
    expect(isUnsupportedDimensionsParamError("Invalid API key")).toBe(false);
  });

  test("ignores errors that mention dimensions without a rejection", () => {
    expect(
      isUnsupportedDimensionsParamError("expected 1024 dimensions, got 1536"),
    ).toBe(false);
    expect(isUnsupportedDimensionsParamError("")).toBe(false);
  });
});
