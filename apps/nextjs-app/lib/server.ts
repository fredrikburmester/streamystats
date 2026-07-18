"use server";

import { z } from "zod/v4";
import { JobServerError, jobServer } from "@/lib/job-server";
import type { ServerPublic } from "@/lib/types";

const createServerSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1).max(1000),
  apiKey: z.string().min(1).max(500),
  localAddress: z.string().max(500).optional(),
  autoGenerateEmbeddings: z.boolean().optional(),
  embeddingProvider: z.enum(["openai-compatible", "ollama"]).optional(),
  embeddingBaseUrl: z.string().max(500).optional(),
  embeddingApiKey: z.string().max(500).optional(),
  embeddingModel: z.string().max(200).optional(),
  embeddingDimensions: z.number().int().positive().max(10000).optional(),
});

interface CreateServerRequest {
  name: string;
  url: string;
  internalUrl?: string;
  apiKey: string;
  localAddress?: string;
  autoGenerateEmbeddings?: boolean;
  embeddingProvider?: "openai-compatible" | "ollama";
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
}

interface CreateServerSuccessResponse {
  success: boolean;
  server: ServerPublic;
  syncJobId: string;
  message: string;
}

interface CreateServerErrorResponse {
  success: false;
  error?: string;
  details?: string;
}

export async function createServer(
  serverData: CreateServerRequest,
): Promise<CreateServerSuccessResponse | CreateServerErrorResponse> {
  const parsed = createServerSchema.safeParse(serverData);
  if (!parsed.success) {
    return { success: false, details: "Invalid input" };
  }

  try {
    const result = await jobServer.createServer(parsed.data);

    const {
      apiKey: _apiKey,
      embeddingApiKey,
      chatApiKey,
      ...rest
    } = result.server;

    return {
      success: result.success,
      syncJobId: result.syncJobId,
      message: result.message,
      server: {
        ...(rest as Omit<ServerPublic, "hasChatApiKey" | "hasEmbeddingApiKey">),
        hasEmbeddingApiKey: Boolean(embeddingApiKey),
        hasChatApiKey: Boolean(chatApiKey),
      },
    };
  } catch (error) {
    console.error("Error creating server:", error);
    if (error instanceof JobServerError) {
      return { success: false, details: error.message };
    }
    return {
      success: false,
      details:
        "Failed to create server. Please check your connection and try again.",
    };
  }
}
