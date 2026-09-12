import { mock } from "bun:test";
import assert from "node:assert/strict";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

mock.module("server-only", () => ({}));

const { CHAT_PROVIDER_PRESETS, createChatModel, detectChatPreset } =
  await import("../providers");
const { testChatConnection } = await import("../../db/server");
const config = {
  provider: "gemini" as const,
  baseUrl: CHAT_PROVIDER_PRESETS.gemini.baseUrl,
  apiKey: "test-gemini-key",
  model: CHAT_PROVIDER_PRESETS.gemini.defaultModel,
};
const apiModel = "gemini-3.8-flash";

assert.equal(createChatModel({ ...config, model: null }), null);
assert.throws(
  () => createChatModel({ ...config, apiKey: " " }),
  /Google Gemini requires an API key/,
);
assert.equal(detectChatPreset({ ...config, baseUrl: null }), "gemini");
assert.equal(
  detectChatPreset({ ...config, baseUrl: "https://gateway.example/gemini" }),
  "gemini",
);
for (const provider of ["openai-compatible", "ollama", "anthropic"] as const) {
  const model = createChatModel({ ...config, provider });
  assert.ok(model && typeof model !== "string");
  assert.equal(model.provider.startsWith("google"), false);
}

const requests: { url: string; headers: Headers; body: any }[] = [];
let responses: Response[] = [];
globalThis.fetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  requests.push({
    url: String(input),
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)),
  });
  const response = responses.shift();
  assert.ok(response, "Unexpected provider request");
  return response;
}) as typeof fetch;

function candidate(parts: unknown[]) {
  return {
    candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
  };
}

function streamResponse(parts: unknown[]) {
  return new Response(`data: ${JSON.stringify(candidate(parts))}\n\n`, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

responses = [Response.json(candidate([{ text: "Hi" }]))];
assert.deepEqual(await testChatConnection({ config }), {
  success: true,
  message: "Connection successful",
});
assert.equal(
  requests[0].url,
  `${config.baseUrl}/models/${apiModel}:generateContent`,
);
assert.deepEqual(requests[0].body.generationConfig.thinkingConfig, {
  thinkingLevel: "high",
});
assert.equal(requests[0].headers.get("x-goog-api-key"), config.apiKey);
assert.equal(requests[0].headers.has("Authorization"), false);
assert.equal(requests[0].url.includes(config.apiKey), false);
assert.equal(requests[0].body.contents[0].parts[0].text, "Hi");

responses = [
  Response.json(
    {
      error: {
        code: 400,
        message: "API key not valid",
        status: "INVALID_ARGUMENT",
      },
    },
    { status: 400 },
  ),
];
const rejected = await testChatConnection({ config });
assert.equal(rejected.success, false);
assert.match(rejected.message, /API key not valid/);
assert.equal(requests.length, 2);
assert.deepEqual(
  await testChatConnection({ config: { ...config, apiKey: undefined } }),
  { success: false, message: "Google Gemini requires an API key" },
);
assert.deepEqual(
  await testChatConnection({ config: { ...config, model: "" } }),
  { success: false, message: "A chat model is required" },
);
assert.equal(requests.length, 2);

responses = [
  streamResponse([
    {
      functionCall: { name: "getWatchStats", args: { userId: "test-user" } },
      thoughtSignature: "test-thought-signature",
    },
  ]),
  streamResponse([{ text: "You watched 42 minutes." }]),
];
const model = createChatModel({
  ...config,
  baseUrl: "https://gateway.example/gemini///",
});
assert.ok(model);
let toolExecutions = 0;
const result = streamText({
  model,
  system: "You are a media assistant.",
  messages: [{ role: "user", content: "How much did I watch?" }],
  tools: {
    getWatchStats: tool({
      description: "Get watch statistics",
      inputSchema: z.object({ userId: z.string() }),
      execute: async ({ userId }) => {
        assert.equal(userId, "test-user");
        toolExecutions++;
        return { minutes: 42 };
      },
    }),
  },
  stopWhen: stepCountIs(5),
  maxRetries: 0,
});
const stream = await result.toUIMessageStreamResponse().text();
assert.match(stream, /tool-input-available/);
assert.match(stream, /tool-output-available/);
assert.match(stream, /You watched 42 minutes\./);
assert.doesNotMatch(stream, /"type":"error"/);
assert.equal(toolExecutions, 1);
assert.equal(requests.length, 4);
assert.equal(
  requests[2].url,
  `https://gateway.example/gemini/models/${apiModel}:streamGenerateContent?alt=sse`,
);
assert.deepEqual(requests[2].body.generationConfig.thinkingConfig, {
  thinkingLevel: "high",
});
assert.equal(
  requests[2].body.systemInstruction.parts[0].text,
  "You are a media assistant.",
);
assert.equal(
  requests[2].body.tools[0].functionDeclarations[0].name,
  "getWatchStats",
);
const continuedParts = requests[3].body.contents.flatMap(
  (content: { parts: any[] }) => content.parts,
);
assert.equal(
  continuedParts.find((part: any) => part.functionCall)?.thoughtSignature,
  "test-thought-signature",
);
assert.deepEqual(
  continuedParts.find((part: any) => part.functionResponse)?.functionResponse
    .response,
  { name: "getWatchStats", content: { minutes: 42 } },
);
assert.equal(responses.length, 0);

let isAdmin = true;
let savedConfigReads = 0;
let testedApiKey: string | undefined;
mock.module("../../db/users", () => ({ isUserAdmin: async () => isAdmin }));
mock.module("../../db/server", () => ({
  getChatConfig: async ({ serverId }: { serverId: number }) => {
    assert.equal(serverId, 1);
    savedConfigReads++;
    return config;
  },
  testChatConnection: async ({
    config: tested,
  }: {
    config: { apiKey?: string };
  }) => {
    testedApiKey = tested.apiKey;
    return { success: !!tested.apiKey, message: "Connection checked" };
  },
  saveChatConfig: async () => {},
  clearChatConfig: async () => {},
}));
const { testChatConnectionAction } = await import(
  "../../../app/(app)/servers/[id]/(auth)/settings/chat/actions"
);
await testChatConnectionAction(1, { ...config, apiKey: undefined });
assert.equal(testedApiKey, config.apiKey);
await testChatConnectionAction(1, { ...config, apiKey: "replacement-key" });
assert.equal(testedApiKey, "replacement-key");
assert.equal(savedConfigReads, 1);
await testChatConnectionAction(1, {
  ...config,
  apiKey: undefined,
  baseUrl: "https://other.example/v1beta",
});
assert.equal(testedApiKey, undefined);
await testChatConnectionAction(1, {
  ...config,
  provider: "openai-compatible",
  apiKey: undefined,
});
assert.equal(testedApiKey, undefined);
assert.equal(savedConfigReads, 2);
isAdmin = false;
await assert.rejects(
  testChatConnectionAction(1, { ...config, apiKey: undefined }),
  /Admin privileges required/,
);
assert.equal(savedConfigReads, 2);
