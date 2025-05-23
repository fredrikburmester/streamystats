import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getServers } from "@/lib/db";

export async function GET(request: NextRequest) {
  // The middleware will set this header if there's a server connectivity issue
  const headersList = headers();
  const connectivityError = headersList.get("x-server-connectivity-error");

  const response = NextResponse.json({ ok: true });

  // If middleware detected a connectivity issue, pass it through to the client
  if (connectivityError) {
    response.headers.set("x-server-connectivity-error", "true");
    return response;
  }

  // Proactively check Jellyfin server connectivity
  try {
    const servers = await getServers();
    let hasConnectivityIssue = false;
    let serverErrors = [];

    // Check each server for connectivity issues
    for (const server of servers) {
      try {
        // Quick health check to Jellyfin server
        const healthCheck = await fetch(
          `${server.external_url || server.url}/System/Ping`,
          {
            method: "GET",
            headers: {
              "X-Emby-Token": server.api_key,
              "Content-Type": "application/json",
            },
            // Short timeout to avoid hanging requests
            signal: AbortSignal.timeout(3000),
          }
        );

        if (!healthCheck.ok) {
          hasConnectivityIssue = true;
          serverErrors.push({
            serverId: server.id,
            name: server.name,
            status: healthCheck.status,
            error: await healthCheck
              .text()
              .catch(() => "Failed to read response"),
          });
        }
      } catch (err) {
        // Network error or timeout
        hasConnectivityIssue = true;
        serverErrors.push({
          serverId: server.id,
          name: server.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // If any server has connectivity issues, set the header
    if (hasConnectivityIssue) {
      response.headers.set("x-server-connectivity-error", "true");
      return NextResponse.json(
        {
          ok: false,
          connectivity_issues: true,
          servers: serverErrors,
        },
        {
          headers: {
            "x-server-connectivity-error": "true",
          },
        }
      );
    }

    // All servers are responsive
    return response;
  } catch (error) {
    // Error accessing database or other internal error
    console.error("Error checking server connectivity:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to check server connectivity",
      },
      {
        status: 500,
      }
    );
  }
}
