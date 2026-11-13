import { describe, expect, test } from "bun:test";
import { normalizeAnthropicBaseUrl } from "./anthropic-url";

describe("normalizeAnthropicBaseUrl", () => {
  test("defaults to the public API when no base URL is set", () => {
    expect(normalizeAnthropicBaseUrl(null)).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(normalizeAnthropicBaseUrl(undefined)).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(normalizeAnthropicBaseUrl("")).toBe("https://api.anthropic.com/v1");
    expect(normalizeAnthropicBaseUrl("  ")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  test("appends /v1 to the stored default", () => {
    expect(normalizeAnthropicBaseUrl("https://api.anthropic.com")).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(normalizeAnthropicBaseUrl("https://api.anthropic.com/")).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(normalizeAnthropicBaseUrl("https://api.anthropic.com///")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  test("keeps a base URL that already ends with /v1", () => {
    expect(normalizeAnthropicBaseUrl("https://api.anthropic.com/v1")).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(normalizeAnthropicBaseUrl("https://api.anthropic.com/v1/")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  test("handles a custom proxy URL", () => {
    expect(
      normalizeAnthropicBaseUrl("https://proxy.example.com/anthropic"),
    ).toBe("https://proxy.example.com/anthropic/v1");
    expect(
      normalizeAnthropicBaseUrl("https://proxy.example.com/anthropic/v1/"),
    ).toBe("https://proxy.example.com/anthropic/v1");
    expect(normalizeAnthropicBaseUrl("http://localhost:8080")).toBe(
      "http://localhost:8080/v1",
    );
  });
});
