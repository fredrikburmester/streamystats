import "server-only";

import { db } from "@streamystats/database";
import { servers } from "@streamystats/database/schema";
import { eq } from "drizzle-orm";

type EmbeddingProvider = "openai-compatible" | "ollama" | "gemini";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Embed text with the server's configured embedding provider, the same way
 * library items are embedded, so the result is comparable to item embeddings.
 */
export async function embedTextForServer({
  serverId,
  text,
}: {
  serverId: number;
  text: string;
}): Promise<
  | { ok: true; embedding: number[] }
  | { ok: false; error: string; reason: "not_configured" | "request_failed" }
> {
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
  });

  const provider = server?.embeddingProvider as EmbeddingProvider | null;
  const baseUrl = server?.embeddingBaseUrl ?? null;
  const model = server?.embeddingModel ?? null;
  const apiKey = server?.embeddingApiKey ?? null;
  const dimensions = server?.embeddingDimensions ?? null;

  if (!provider || !baseUrl || !model) {
    return {
      ok: false,
      reason: "not_configured",
      error:
        "Embeddings are not configured for this server. Configure them in Settings > Embeddings.",
    };
  }

  try {
    if (provider === "ollama") {
      const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: text }),
      });

      if (!res.ok) {
        return {
          ok: false,
          reason: "request_failed",
          error: `Embedding request failed (status ${res.status})`,
        };
      }

      const json = (await res.json()) as {
        embeddings?: number[][];
      };
      const embedding = json.embeddings?.[0];
      if (!Array.isArray(embedding) || embedding.length === 0) {
        return {
          ok: false,
          reason: "request_failed",
          error: "Embedding request returned no embedding vector",
        };
      }
      return { ok: true, embedding };
    }

    if (provider === "gemini") {
      const normalized = normalizeBaseUrl(baseUrl);
      const geminiModel = model.startsWith("models/")
        ? model
        : `models/${model}`;
      const res = await fetch(`${normalized}/${geminiModel}:embedContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-goog-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          model: geminiModel,
          content: { parts: [{ text }] },
          taskType: "SEMANTIC_SIMILARITY",
          ...(dimensions && dimensions > 0
            ? { outputDimensionality: dimensions }
            : {}),
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          reason: "request_failed",
          error: `Embedding request failed (status ${res.status})`,
        };
      }

      const json = (await res.json()) as {
        embedding?: { values?: number[] };
      };
      const embedding = json.embedding?.values;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        return {
          ok: false,
          reason: "request_failed",
          error: "Embedding request returned no embedding vector",
        };
      }
      return { ok: true, embedding };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const body: Record<string, unknown> = { model, input: text };
    if (typeof dimensions === "number" && dimensions > 0) {
      body.dimensions = dimensions;
    }

    const normalized = normalizeBaseUrl(baseUrl);
    const embeddingsUrl = normalized.endsWith("/v1")
      ? `${normalized}/embeddings`
      : `${normalized}/v1/embeddings`;
    const res = await fetch(embeddingsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return {
        ok: false,
        reason: "request_failed",
        error: `Embedding request failed (status ${res.status})`,
      };
    }

    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = json.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return {
        ok: false,
        reason: "request_failed",
        error: "Embedding request returned no embedding vector",
      };
    }
    return { ok: true, embedding };
  } catch (error) {
    return {
      ok: false,
      reason: "request_failed",
      error:
        error instanceof Error ? error.message : "Embedding request failed",
    };
  }
}
