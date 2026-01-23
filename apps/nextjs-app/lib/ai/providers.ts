import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ChatProvider = "openai-compatible" | "ollama" | "anthropic";

export interface ChatConfig {
  provider: ChatProvider | null;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
}

export const CHAT_PROVIDER_PRESETS = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-latest",
    requiresApiKey: true,
    provider: "anthropic" as ChatProvider,
  },
  "together-ai": {
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  fireworks: {
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  ollama: {
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    requiresApiKey: false,
    provider: "ollama" as ChatProvider,
  },
  "lm-studio": {
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
    requiresApiKey: false,
    provider: "openai-compatible" as ChatProvider,
  },
  custom: {
    name: "Custom",
    baseUrl: "",
    defaultModel: "",
    requiresApiKey: false,
    provider: "openai-compatible" as ChatProvider,
  },
} as const;

export type ChatPresetKey = keyof typeof CHAT_PROVIDER_PRESETS;

export function createChatModel(config: ChatConfig): LanguageModel | null {
  if (!config.provider || !config.model) {
    return null;
  }

  switch (config.provider) {
    case "anthropic": {
      if (!config.apiKey) {
        throw new Error("Anthropic requires an API key");
      }
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      });
      return anthropic(config.model);
    }

    case "ollama": {
      const ollama = createOpenAI({
        baseURL: config.baseUrl || "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      // Use .chat() explicitly to avoid Responses API which Ollama doesn't support
      return ollama.chat(config.model);
    }

    default: {
      const openai = createOpenAI({
        baseURL: config.baseUrl || "https://api.openai.com/v1",
        apiKey: config.apiKey || "",
      });
      // Use .chat() to avoid Responses API - most OpenAI-compatible providers
      // (LM Studio, Together, Groq, etc.) don't support item_reference in input
      return openai.chat(config.model);
    }
  }
}

export function detectChatPreset(config: ChatConfig): ChatPresetKey {
  const baseUrl = config.baseUrl || "";
  for (const [key, preset] of Object.entries(CHAT_PROVIDER_PRESETS)) {
    if (key !== "custom" && baseUrl === preset.baseUrl) {
      return key as ChatPresetKey;
    }
  }
  if (config.provider === "anthropic") {
    return "anthropic";
  }
  return baseUrl ? "custom" : "openai";
}
