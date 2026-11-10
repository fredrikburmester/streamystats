import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { type ChatConfig, createChatModel } from "@/lib/ai/providers";
import { createChatTools } from "@/lib/ai/tools";
import { getServerWithSecrets } from "@/lib/db/server";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

function errorHandler(error: unknown): string {
  if (error == null) {
    return "unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return JSON.stringify(error);
}

const BASE_SYSTEM_PROMPT = `You are a helpful media assistant for Streamystats, a Jellyfin statistics and analytics platform. You help users discover content, understand their watching habits, and get personalized recommendations.

Your capabilities:
- Find user's most watched movies and series
- Provide personalized AI-powered recommendations based on watch history
- Search the media library by name, genre, or semantic theme (embeddings)
- Show recently added content
- Get watch statistics (total time, streaks, etc.)
- Query watchtime by date range, user, and item type (e.g., "who watched the most yesterday?")
- Find shared recommendations for multiple users to watch together
- Filter content by genre or rating

Guidelines:
- Be concise and helpful
- When showing lists, format them nicely with key details (name, year, rating)
- If recommendations require embeddings and none are found, suggest the user configure AI embeddings in settings
- For watch time, always convert seconds to human-readable format (hours/minutes)
- When users ask about watching with someone else, use the shared recommendations tool
- When the user asks for a themed pick they already have (e.g. "a Christmas movie that I have"), prefer semantic library search over genre search. "Christmas" is often a theme, not a reliable genre label.
- Be conversational and friendly

IMPORTANT - Item linking format:
When mentioning movies or series from tool results, ALWAYS use standard markdown links with the item:// scheme:
[ITEM_NAME](item://ITEM_ID)

For example: "I recommend [The Matrix](item://abc123) because you enjoyed sci-fi films."
Or: "Your most watched movie is [Inception](item://def456) with 5 plays."

This format allows the UI to render items as clickable cards with poster images. Always use the exact id from the tool results.

IMPORTANT - Recommendation format:
When presenting recommendations, ALWAYS explain what each recommendation is based on using the "basedOn" and "reason" fields from the tool results. Format like:
- "I recommend [title](item://id) because you watched [basedOn names]"
- "Since you enjoyed [basedOn names], you might like [title](item://id)"
- "Based on your viewing of [basedOn names], I suggest [title](item://id)"

Never list recommendations without mentioning what they're based on. The basedOn data shows which items from the user's watch history led to each recommendation.`;

export async function POST(req: Request) {
  try {
    const { messages, serverId }: { messages: UIMessage[]; serverId: string } =
      await req.json();

    if (!serverId) {
      return new Response(JSON.stringify({ error: "Server ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [server, session] = await Promise.all([
      getServerWithSecrets({ serverId }),
      getSession(),
    ]);

    if (!server) {
      return new Response(JSON.stringify({ error: "Server not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!session) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (session.serverId !== server.id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Access denied for this server.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const chatConfig: ChatConfig = {
      provider: server.chatProvider as ChatConfig["provider"],
      baseUrl: server.chatBaseUrl,
      apiKey: server.chatApiKey,
      model: server.chatModel,
    };

    const model = createChatModel(chatConfig);

    if (!model) {
      return new Response(
        JSON.stringify({
          error:
            "AI Chat not configured. Please configure it in Settings > AI Chat.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const tools = createChatTools(server.id, session.id, session.isAdmin);
    const convertedMessages = convertToModelMessages(messages);

    const result = streamText({
      model,
      system: `${BASE_SYSTEM_PROMPT}
      
Current user context:
- Name: ${session.name}
- ID: ${session.id}
`,
      messages: convertedMessages,
      tools,
      stopWhen: stepCountIs(5),
      onError: ({ error }) => {
        console.error("[Chat API] Stream error:", error);
      },
    });

    return result.toUIMessageStreamResponse({
      onError: errorHandler,
    });
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
