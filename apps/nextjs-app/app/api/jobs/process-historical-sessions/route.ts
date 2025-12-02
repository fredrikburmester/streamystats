interface RouteParams {
  // No params needed for this endpoint
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serverId, startDate, endDate, batchSize } = body;

    if (!serverId) {
      return new Response(
        JSON.stringify({
          error: "Server ID is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const jobServerUrl =
      process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
        ? process.env.JOB_SERVER_URL
        : "http://localhost:3005";

    const response = await fetch(
      `${jobServerUrl}/api/jobs/process-historical-sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          serverId,
          startDate,
          endDate,
          batchSize: batchSize || 1000
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error starting historical session processing:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to start historical session processing",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
