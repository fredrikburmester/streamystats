import { describe, expect, test } from "bun:test";
import { APIError } from "openai";
import { isUnsupportedDimensionsParamError } from "./embedding-errors";

// The body Mistral returns for /v1/embeddings when `dimensions` is sent (issue #607).
const mistralBody = {
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
};

describe("isUnsupportedDimensionsParamError", () => {
  test("matches the Mistral 422 as the OpenAI SDK raises it", () => {
    const error = APIError.generate(
      422,
      { error: mistralBody },
      undefined,
      new Headers(),
    );
    expect(isUnsupportedDimensionsParamError(error)).toBe(true);
  });

  test("matches the Mistral body when only the detail entry is given", () => {
    expect(
      isUnsupportedDimensionsParamError(
        JSON.stringify(mistralBody.message.detail[0]),
      ),
    ).toBe(true);
  });

  test("matches the body on an axios-style error", () => {
    const error = Object.assign(
      new Error("Request failed with status code 422"),
      { response: { status: 422, data: mistralBody } },
    );
    expect(isUnsupportedDimensionsParamError(error)).toBe(true);
  });

  test("keeps matching the older wordings", () => {
    expect(
      isUnsupportedDimensionsParamError(
        new Error("400 Unrecognized request argument supplied: dimensions"),
      ),
    ).toBe(true);
    expect(
      isUnsupportedDimensionsParamError(
        new Error("This model does not support the dimensions parameter: unsupported"),
      ),
    ).toBe(true);
  });

  test("ignores rejections that do not mention dimensions", () => {
    expect(
      isUnsupportedDimensionsParamError(
        new Error('422 {"type":"extra_forbidden","loc":["body","foo"],"msg":"Extra inputs are not permitted"}'),
      ),
    ).toBe(false);
    expect(isUnsupportedDimensionsParamError(new Error("401 Invalid API key"))).toBe(
      false,
    );
  });

  test("ignores errors that mention dimensions without a rejection", () => {
    expect(
      isUnsupportedDimensionsParamError(
        new Error("expected 1024 dimensions, got 1536"),
      ),
    ).toBe(false);
  });

  test("handles non-error values", () => {
    expect(isUnsupportedDimensionsParamError(null)).toBe(false);
    expect(isUnsupportedDimensionsParamError(undefined)).toBe(false);
  });
});
