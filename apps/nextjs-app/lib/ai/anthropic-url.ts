const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

/**
 * The AI SDK's Anthropic provider posts to `${baseURL}/messages`, so its base URL
 * must include the `/v1` segment. Settings store `https://api.anthropic.com` by
 * default while some users typed `.../v1` to work around that, so accept both.
 */
export function normalizeAnthropicBaseUrl(
  baseUrl: string | null | undefined,
): string {
  const trimmed = (baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_ANTHROPIC_BASE_URL;
  }
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}
