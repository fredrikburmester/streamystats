import { db, hiddenRecommendations, sessions } from "@streamystats/database";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getServerWithSecrets } from "@/lib/db/server";

type JellyfinSystemInfo = {
  Id?: string;
};

function normalizeUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function tryFetchJellyfinSystemInfo({
  url,
  apiKey,
}: {
  url: string;
  apiKey: string;
}): Promise<JellyfinSystemInfo | null> {
  try {
    const res = await fetch(`${normalizeUrl(url)}/System/Info`, {
      method: "GET",
      headers: {
        "Authorization": `MediaBrowser Client="Streamystats", Token="${apiKey}"`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as JellyfinSystemInfo;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    // Require admin for data export
    const { error } = await requireAdmin();
    if (error) return error;

    const { serverId } = await params;
    const serverIdNum = Number(serverId);
    if (Number.isNaN(serverIdNum)) {
      return new Response(JSON.stringify({ error: "Invalid server id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const server = await getServerWithSecrets({ serverId });
    if (!server) {
      return new Response(JSON.stringify({ error: "Server not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const jellyfinInfo = await tryFetchJellyfinSystemInfo({
      url: server.url,
      apiKey: server.apiKey,
    });

    const [exportedSessions, exportedHiddenRecommendations] = await Promise.all(
      [
        db.query.sessions.findMany({
          where: eq(sessions.serverId, serverIdNum),
        }),
        db.query.hiddenRecommendations.findMany({
          where: eq(hiddenRecommendations.serverId, serverIdNum),
        }),
      ],
    );

    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        serverName: server.name,
        serverId: server.id,
        version: "streamystats",
        exportType: "backup",
      },

      counts: {
        sessions: exportedSessions.length,
        hiddenRecommendations: exportedHiddenRecommendations.length,
      },

      // Server (safe-to-export) settings + Jellyfin identity hint
      server: {
        id: server.id,
        name: server.name,
        url: server.url,
        localAddress: server.localAddress,
        version: server.version,
        productName: server.productName,
        operatingSystem: server.operatingSystem,
        jellyfinSystemId: jellyfinInfo?.Id ?? null,

        // Settings worth retaining on restore (exclude secrets like apiKey/chatApiKey/embeddingApiKey)
        startupWizardCompleted: server.startupWizardCompleted,
        autoGenerateEmbeddings: server.autoGenerateEmbeddings,
        embeddingProvider: server.embeddingProvider,
        embeddingBaseUrl: server.embeddingBaseUrl,
        embeddingModel: server.embeddingModel,
        embeddingDimensions: server.embeddingDimensions,
        chatProvider: server.chatProvider,
        chatBaseUrl: server.chatBaseUrl,
        chatModel: server.chatModel,
        disabledHolidays: server.disabledHolidays,
        excludedUserIds: server.excludedUserIds,
        excludedLibraryIds: server.excludedLibraryIds,
      },

      // Data (server-scoped, non-Jellyfin derived)
      sessions: exportedSessions,
      hiddenRecommendations: exportedHiddenRecommendations,
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `streamystats-backup-${server.name.replace(
      /[^a-zA-Z0-9]/g,
      "-",
    )}-${timestamp}.json`;

    // Return JSON response with proper headers for download
    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Count": exportData.counts.sessions.toString(),
        "X-Export-Server": server.name,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({
        error: "Export failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
